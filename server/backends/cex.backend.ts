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

    // ExecutionRequest intentionally carries only paper-proposal fields. It
    // must never be coerced into a live mandate, balance snapshot, or caller
    // idempotency key. A future owner-only flow has to mint a
    // ServerDerivedLiveOrderIntent before it can call the sealed adapter.
    return {
      status: "blocked",
      reason: "CEX execution requires a server-derived live-order intent; generic proposal execution remains unavailable while venue mutations are sealed.",
      timestamp: Date.now(),
    };
  }
}
