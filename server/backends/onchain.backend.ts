/**
 * On-chain ExecutionBackend (Sailor / WalletConnect)
 * 
 * Implements the ExecutionBackend interface for non-custodial on-chain execution.
 * Requires wallet connection, transaction simulation, and owner signature.
 * Planned for Phase 3+; currently disabled.
 */

import type { ExecutionBackend, ExecutionRequest, ExecutionResult, ExecutionBackendType } from "@shared/executionBackend";
import { canPlaceOrders, isBlockedByDominantState } from "@shared/authorityState";

export class OnchainExecutionBackend implements ExecutionBackend {
  readonly type: ExecutionBackendType = "onchain";
  readonly label = "Non-custodial On-chain (Sailor / WalletConnect)";

  async verify(): Promise<void> {
    // On-chain backend requires wallet connection + Sailor protocol
    // TODO: Phase 3 - implement on-chain configuration validation
    throw new Error("On-chain execution backend is not yet enabled. Phase 3+ feature.");
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

    // TODO: Phase 3 - implement on-chain order submission
    // 1. Load wallet connection (WalletConnect / Sailor)
    // 2. Simulate transaction
    // 3. Build transaction (swap, liquidity, etc.)
    // 4. Request owner signature
    // 5. Broadcast + monitor
    // 6. Record to ledger + activity journal
    
    return {
      status: "rejected",
      reason: "On-chain execution backend is not yet implemented.",
      timestamp: Date.now(),
    };
  }
}
