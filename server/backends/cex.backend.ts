/**
 * CEX (Centralized Exchange) ExecutionBackend
 * 
 * Implements the ExecutionBackend interface for real CEX execution (Binance, OKX, etc.).
 * Requires live API keys, mandate validation, and order approval.
 * Planned for Phase 2+; currently disabled.
 */

import type { ExecutionBackend, ExecutionRequest, ExecutionResult, ExecutionBackendType } from "@shared/executionBackend";
import { canPlaceOrders, isBlockedByDominantState } from "@shared/authorityState";

export class CEXExecutionBackend implements ExecutionBackend {
  readonly type: ExecutionBackendType = "cex";
  readonly label = "Centralized Exchange (Binance, OKX, etc.)";

  async verify(): Promise<void> {
    // CEX backend requires API keys and configuration
    // TODO: Phase 2 - implement CEX configuration validation
    throw new Error("CEX execution backend is not yet enabled. Phase 2+ feature.");
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

    // TODO: Phase 2 - implement CEX order submission
    // 1. Load API key from KMS
    // 2. Connect to venue
    // 3. Validate mandate + order params
    // 4. Submit order
    // 5. Record to ledger + activity journal
    
    return {
      status: "rejected",
      reason: "CEX execution backend is not yet implemented.",
      timestamp: Date.now(),
    };
  }
}
