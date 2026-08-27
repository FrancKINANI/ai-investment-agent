/**
 * Agent Execution Pipeline
 *
 * Connects agent research proposals to real execution via:
 * 1. CEX execution (Binance API) — for trading on centralized exchanges
 * 2. On-chain execution (Sailor Protocol) — for DeFi operations
 *
 * Safety design:
 * - Every execution requires an active mandate (real or armed mode)
 * - Order/value caps are checked before submission
 * - All attempts are logged to the immutable Activity record
 * - Critical alerts for fills, rejections, and revocations
 * - Agent can only act within the currently active mandate
 */

import { nanoid } from "nanoid";
import {
  executeMandateTransaction,
  getMandate,
  type SailorMandate,
  type MandateScope,
} from "./sailorService";
import { createOperatorAction, createSecurityAlert, listWalletMandates } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────

export type AgentProposal = {
  proposalId: string;
  title: string;
  rationale: string;
  action: {
    kind: string;
    address?: string;
    symbol?: string;
    side?: "BUY" | "SELL";
    type?: "MARKET" | "LIMIT";
    quantity?: number;
    price?: number;
    quoteOrderQty?: number;
    protocol?: string;
    amount?: string;
  };
  venue: string;
  walletRole: string;
  status: string;
};

export type ExecutionResult = {
  success: boolean;
  type: "cex" | "on-chain";
  orderId?: number;
  txHash?: string;
  error?: string;
  mandateId?: string;
};

// ─── CEX Execution ────────────────────────────────────────────────────────

/**
 * Execute a CEX order from an agent proposal.
 *
 * Flow:
 * 1. Find active Binance mandate
 * 2. Find active Binance API key
 * 3. Get account balance for limit checking
 * 4. Execute order through live adapter (validates mandate)
 * 5. Log result and emit alerts
 */
export async function executeCexOrder(
  userId: number,
  proposal: AgentProposal,
  platformKeyId?: string,
): Promise<ExecutionResult> {
  // 1. Find active mandate
  const mandates = await listWalletMandates(userId);
  const mandate = mandates.find((m) => m.venue === "binance" && m.status === "active") ?? null;

  if (!mandate) {
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "simulation_blocked",
      status: "blocked",
      subject: `CEX order blocked: ${proposal.title}`,
      detail: "No active Binance mandate. Create and activate a mandate before executing CEX orders.",
      payload: { proposalId: proposal.proposalId, venue: "binance" },
    });
    return { success: false, type: "cex", error: "No active Binance mandate." };
  }

  if (mandate.mode !== "real" && mandate.mode !== "armed") {
    return { success: false, type: "cex", error: `Mandate mode is "${mandate.mode}". Real mode required.` };
  }

  // Agent proposals are not owner-approved typed live intents. In particular,
  // their symbol, quantity, balance, mandate/key versions, approval payload,
  // and idempotency key must never be defaulted or accepted from the agent.
  // The sealed adapter is intentionally not reachable from this path.
  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "simulation_blocked",
    status: "blocked",
    subject: `CEX order blocked: ${proposal.title}`,
    detail: "Agent-proposed CEX execution requires a separately minted server-derived live-order intent and remains sealed.",
    payload: { proposalId: proposal.proposalId, venue: proposal.venue, platformKeyProvided: Boolean(platformKeyId), mandateId: mandate.mandateId },
  });
  return { success: false, type: "cex", error: "CEX execution requires a server-derived owner intent and is sealed in this release.", mandateId: mandate.mandateId };
}

// ─── On-Chain Execution ───────────────────────────────────────────────────

/**
 * Execute an on-chain transaction from an agent proposal.
 *
 * Flow:
 * 1. Find active Sailor mandate for the chain
 * 2. Validate scope matches proposal action
 * 3. Execute through Sailor mandate
 * 4. Log result and emit alerts
 */
export async function executeOnChainTx(
  userId: number,
  proposal: AgentProposal,
  chainId: number = 1,
): Promise<ExecutionResult> {
  // 1. Find active Sailor mandate
  const sailorMandates = (await import("./sailorService")).listMandates(userId);
  const mandate = sailorMandates.find(
    (m) => m.chainId === chainId && m.status === "active" && !m.revokedAt,
  );

  if (!mandate) {
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "simulation_blocked",
      status: "blocked",
      subject: `On-chain tx blocked: ${proposal.title}`,
      detail: `No active Sailor mandate for chain ${chainId}. Create and activate a mandate before executing on-chain.`,
      payload: { proposalId: proposal.proposalId, chainId },
    });
    return { success: false, type: "on-chain", error: `No active Sailor mandate for chain ${chainId}.` };
  }

  // 2. Validate scope
  const requiredScope = mapActionToScope(proposal.action.kind);
  if (requiredScope && !(mandate.scopes as string[]).includes(requiredScope)) {
    await createSecurityAlert(userId, {
      alertId: nanoid(),
      level: "warning",
      category: "scope-violation",
      title: `Mandate scope violation`,
      detail: `Agent action "${proposal.action.kind}" requires scope "${requiredScope}" but mandate only allows: ${mandate.scopes.join(", ")}.`,
    });
    return { success: false, type: "on-chain", error: `Mandate does not include scope "${requiredScope}".` };
  }

  // 3. Execute
  try {
    const tx = await executeMandateTransaction(userId, mandate.mandateId, {
      to: proposal.action.address ?? "0x0000000000000000000000000000000000000000",
      value: proposal.action.amount ?? "0",
      data: "0x",
      chainId,
    });

    return {
      success: true,
      type: "on-chain",
      txHash: tx.txId,
      mandateId: mandate.mandateId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "On-chain execution failed.";

    await createSecurityAlert(userId, {
      alertId: nanoid(),
      level: "warning",
      category: "execution-failed",
      title: `On-chain tx failed`,
      detail: `Agent on-chain transaction failed: ${errorMsg}`,
    });

    return { success: false, type: "on-chain", error: errorMsg };
  }
}

// ─── Unified Executor ─────────────────────────────────────────────────────

/**
 * Execute an agent proposal through the appropriate path.
 *
 * Routes to CEX or on-chain based on the proposal's venue.
 */
export async function executeAgentProposal(
  userId: number,
  proposal: AgentProposal,
  options: {
    platformKeyId?: string;
    chainId?: number;
  } = {},
): Promise<ExecutionResult> {
  // Log the execution attempt
  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "scope_checked",
    status: "review",
    subject: `Agent execution: ${proposal.title}`,
    detail: `Agent proposed execution via ${proposal.venue}. Validating mandate and limits.`,
    payload: {
      proposalId: proposal.proposalId,
      venue: proposal.venue,
      action: proposal.action,
      walletRole: proposal.walletRole,
    },
  });

  // Route to appropriate executor
  if (proposal.venue === "binance" || proposal.venue === "okx" || proposal.venue === "coinbase" || proposal.venue === "kraken") {
    return executeCexOrder(userId, proposal, options.platformKeyId);
  }

  if (proposal.venue === "evm" || proposal.venue === "polymarket") {
    return executeOnChainTx(userId, proposal, options.chainId ?? 1);
  }

  return { success: false, type: "cex", error: `Unknown venue: ${proposal.venue}` };
}

// ─── Utilities ────────────────────────────────────────────────────────────

/**
 * Map an action kind to a Sailor mandate scope.
 */
function mapActionToScope(kind: string): MandateScope | null {
  const scopeMap: Record<string, MandateScope> = {
    token_swap: "swap",
    swap: "swap",
    add_liquidity: "add_liquidity",
    remove_liquidity: "remove_liquidity",
    stake: "stake",
    claim: "claim",
    transfer: "transfer",
    send: "transfer",
  };
  return scopeMap[kind] ?? null;
}
