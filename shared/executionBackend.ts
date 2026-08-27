/**
 * Ledgerline ExecutionBackend: Pluggable execution adapters.
 * 
 * All specialized agents follow one unified pipeline:
 *   Research → Decision → Execution
 * 
 * The execution layer is abstracted so operators can swap backends via config.
 * A backend handles actual order submission, fills, and result recording.
 */

import type { PaperMandate } from "./paperExecution";
import type { AuthorityState } from "./authorityState";

export type ExecutionBackendType = "paper" | "cex" | "onchain";

export type ExecutionRequest = {
  userId: number;
  proposalId: string;
  venue: string; // "binance", "okx", "sailor", etc.
  walletRole: string;
  order: {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    limitPrice?: number;
  };
  mandate: PaperMandate | null;
  authorityState: AuthorityState;
  metadata: {
    policyVersion: number;
    lineageId?: string;
    strategyId?: string;
  };
};

export type ExecutionResult =
  | {
      status: "submitted" | "filled" | "partially_filled";
      orderId: string;
      executedQty: number;
      fillPrice?: number;
      timestamp: number;
    }
  | {
      status: "rejected" | "blocked";
      reason: string;
      timestamp: number;
    };

/**
 * ExecutionBackend interface.
 * All backends implement the same contract:
 * - Check authority state
 * - Verify mandate limits
 * - Submit order
 * - Record result
 */
export interface ExecutionBackend {
  /** Backend identifier (paper, cex, onchain, etc.) */
  readonly type: ExecutionBackendType;

  /** Backend label for UI/logs */
  readonly label: string;

  /**
   * Verify the backend is available and configured.
   * Throws if backend cannot be used.
   */
  verify(): Promise<void>;

  /**
   * Execute a single order through this backend.
   * Responsible for:
   * - Authority state checks
   * - Mandate validation
   * - Order submission
   * - Result recording
   * 
   * Throws on unrecoverable errors (permission denied, mandate expired, etc.).
   * Returns ExecutionResult for all outcomes (filled, rejected, blocked, etc.).
   */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

/**
 * ExecutionBackendRegistry: Load and manage available backends.
 * Backends are registered at startup based on config.
 */
export interface ExecutionBackendRegistry {
  /** Get all available backends */
  backends(): Map<ExecutionBackendType, ExecutionBackend>;

  /** Get a specific backend by type */
  get(type: ExecutionBackendType): ExecutionBackend | undefined;

  /** Get the active backend for this deployment */
  active(): ExecutionBackend;

  /** Select an already registered backend. Venue mutations remain governed by their own fail-closed boundary. */
  setActive(type: ExecutionBackendType): void;

  /** Register a backend (for testing or dynamic config) */
  register(backend: ExecutionBackend): void;
}
