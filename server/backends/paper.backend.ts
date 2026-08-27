/**
 * Paper/Sandbox ExecutionBackend
 * 
 * Implements the ExecutionBackend interface using the append-only paper ledger.
 * No external venue connection. All fills are deterministic based on reference price.
 * Used for research, simulation, and testing.
 */

import { submitPaperOrder, type SubmitPaperOrderArgs } from "./paperExecutor";
import type { ExecutionBackend, ExecutionRequest, ExecutionResult, ExecutionBackendType } from "@shared/executionBackend";
import { canPlaceOrders, isBlockedByDominantState } from "@shared/authorityState";
import type { ReferencePrice } from "@shared/paperExecution";

export class PaperExecutionBackend implements ExecutionBackend {
  readonly type: ExecutionBackendType = "paper";
  readonly label = "Paper / Sandbox Execution";

  async verify(): Promise<void> {
    // Paper backend requires no external config; always available
    return;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    // S2: Authority checks
    if (isBlockedByDominantState(request.authorityState)) {
      return {
        status: "blocked",
        reason: "Owner authority is paused or revoked.",
        timestamp: Date.now(),
      };
    }

    if (!canPlaceOrders(request.authorityState)) {
      return {
        status: "blocked",
        reason: `Authority state '${request.authorityState}' does not permit orders.`,
        timestamp: Date.now(),
      };
    }

    // S3: Mandate validation (hard gate on order parameters)
    if (!request.mandate) {
      return {
        status: "rejected",
        reason: "No active mandate found for this order.",
        timestamp: Date.now(),
      };
    }

    // Build paper order from execution request
    const referencePrice: ReferencePrice | null = request.order.limitPrice
      ? { source: "owner-supplied", price: request.order.limitPrice, timestamp: Date.now() }
      : null;

    const args: SubmitPaperOrderArgs = {
      userId: request.userId,
      input: {
        idempotencyKey: request.proposalId,
        symbol: request.order.symbol,
        side: request.order.side as "buy" | "sell",
        orderType: "limit",
        timeInForce: "GTC",
        quantity: request.order.quantity,
        limitPrice: request.order.limitPrice ?? 0,
      },
      mandate: request.mandate,
      mandateBalanceUsd: request.mandate.balanceUsd,
      referencePrice,
    };

    try {
      const result = await submitPaperOrder(args);

      switch (result.status) {
        case "filled":
        case "partially_filled":
          return {
            status: result.status === "filled" ? "filled" : "partially_filled",
            orderId: result.orderId,
            executedQty: result.executedQty,
            fillPrice: result.fillPrice,
            timestamp: Date.now(),
          };
        case "duplicate":
          return {
            status: "submitted",
            orderId: result.orderId,
            executedQty: 0,
            timestamp: Date.now(),
          };
        case "rejected":
          return {
            status: "rejected",
            reason: result.reason,
            timestamp: Date.now(),
          };
        default:
          const _exhaustive: never = result;
          return _exhaustive;
      }
    } catch (error) {
      return {
        status: "rejected",
        reason: error instanceof Error ? error.message : "Paper execution failed",
        timestamp: Date.now(),
      };
    }
  }
}
