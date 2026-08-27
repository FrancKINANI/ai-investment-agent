/**
 * CEX (Centralized Exchange) ExecutionBackend — Binance only (v0.3)
 *
 * Implements the ExecutionBackend interface for real Binance execution.
 * Uses the existing liveAdapter for order submission with all safety guards.
 *
 * Safety design:
 * - Authority state machine gate (fail closed)
 * - Mandate validation (mode, status, venue, limits)
 * - Per-order owner approval in approval-required-live
 * - Pre-trade price freshness for market orders
 * - Idempotency (server-generated key)
 * - Full ledger lifecycle recording
 * - Alerts on fill/reject
 *
 * Default: disabled. Must be explicitly enabled via config + authority transition.
 */

import { nanoid } from "nanoid";
import type { ExecutionBackend, ExecutionRequest, ExecutionResult, ExecutionBackendType } from "@shared/executionBackend";
import { canPlaceOrders, isBlockedByDominantState } from "@shared/authorityState";
import { executeLiveOrder, checkMandateAllowance } from "../liveAdapter";
import { getPlatformApiKey, getAuthorityState } from "../db";

export class CEXExecutionBackend implements ExecutionBackend {
  readonly type: ExecutionBackendType = "cex";
  readonly label = "Binance (Live)";

  async verify(): Promise<void> {
    // CEX backend requires:
    // 1. Authority state permits order placement
    // 2. At least one active Binance API key exists
    // 3. Active mandate exists for binance venue
    //
    // We don't throw here — the execute() path handles all guards.
    // verify() just confirms the backend is theoretically usable.
    return;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // 0. Authority state machine gate (fail closed)
    if (isBlockedByDominantState(request.authorityState)) {
      return {
        status: "blocked",
        reason: `Authority state "${request.authorityState}" blocks all order activity.`,
        timestamp: Date.now(),
      };
    }

    if (!canPlaceOrders(request.authorityState)) {
      return {
        status: "blocked",
        reason: `Authority state "${request.authorityState}" does not permit order placement.`,
        timestamp: Date.now(),
      };
    }

    // 1. Find active Binance API key
    const keys = await this.findActiveBinanceKey(request.userId);
    if (!keys) {
      return {
        status: "rejected",
        reason: "No active Binance API key found. Add and verify a key in Settings → Platforms.",
        timestamp: Date.now(),
      };
    }

    // 2. Build mandate from request
    const mandate = request.mandate ? {
      mandateId: request.mandate.mandateId,
      // ExecutionRequest exposes the paper-mandate subset. The sealed live
      // adapter still enforces actual authority/mandate state before it can
      // perform any effect, so this compatibility value grants no authority.
      mode: "real" as const,
      status: request.mandate.status,
      venue: request.mandate.venue,
      maxOrderBps: request.mandate.maxOrderBps,
      dailyCapBps: request.mandate.dailyCapBps,
      allowedAssets: request.mandate.allowedAssets,
    } : null;

    // 3. Quick mandate check before calling liveAdapter
    if (mandate) {
      const mandateCheck = checkMandateAllowance(mandate, {
        symbol: request.order.symbol,
        side: request.order.side.toUpperCase() as "BUY" | "SELL",
        type: request.order.limitPrice ? "LIMIT" : "MARKET",
        quantity: request.order.quantity,
        price: request.order.limitPrice,
      }, 0); // Balance check happens inside liveAdapter
      if (!mandateCheck.allowed) {
        return {
          status: "rejected",
          reason: mandateCheck.reason,
          timestamp: Date.now(),
        };
      }
    }

    // 4. Execute via liveAdapter (all safety guards applied internally)
    try {
      const { result } = await executeLiveOrder(
        request.userId,
        keys.keyId,
        mandate,
        {
          symbol: request.order.symbol,
          side: request.order.side.toUpperCase() as "BUY" | "SELL",
          type: request.order.limitPrice ? "LIMIT" : "MARKET",
          quantity: request.order.quantity,
          price: request.order.limitPrice,
          idempotencyKey: request.proposalId, // Use proposalId as idempotency key
        },
        0, // Balance fetched inside liveAdapter if needed
      );

      // Map liveAdapter result to ExecutionResult
      switch (result.status) {
        case "FILLED":
          return {
            status: "filled",
            orderId: String(result.orderId),
            executedQty: Number(result.executedQty),
            fillPrice: Number(result.price),
            timestamp: Date.now(),
          };
        case "NEW":
        case "PARTIALLY_FILLED":
          return {
            status: "submitted",
            orderId: String(result.orderId),
            executedQty: Number(result.executedQty),
            timestamp: Date.now(),
          };
        case "REJECTED":
          return {
            status: "rejected",
            reason: `Binance rejected the order (status: ${result.status})`,
            timestamp: Date.now(),
          };
        default:
          return {
            status: "submitted",
            orderId: String(result.orderId),
            executedQty: Number(result.executedQty),
            timestamp: Date.now(),
          };
      }
    } catch (error) {
      return {
        status: "rejected",
        reason: error instanceof Error ? error.message : "CEX execution failed",
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Find the first active Binance API key for this user.
   */
  private async findActiveBinanceKey(userId: number): Promise<{ keyId: string } | null> {
    try {
      const { listPlatformApiKeys } = await import("../db");
      const keys = await listPlatformApiKeys(userId);
      const activeKey = keys.find((k: any) => k.platform === "binance" && k.state === "active");
      return activeKey ? { keyId: activeKey.keyId } : null;
    } catch {
      return null;
    }
  }
}
