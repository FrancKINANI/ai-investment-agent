/**
 * ExecutionOrchestrator: Unified proposal approval → execution pipeline.
 * 
 * Handles the decision flow:
 *   1. Policy check (IPS approved?)
 *   2. Hard evaluation gate (evidence sufficient? complexity reasonable?)
 *   3. Owner approval (yes, I approve this proposal)
 *   4. Execution (submit order through configured backend)
 * 
 * Separated from HTTP router so logic is reusable and testable.
 */

import { nanoid } from "nanoid";
import { getAuthorityState, getAgentProposal, updateAgentProposalStatus, createOperatorAction, createAwarenessRecord, listWalletMandates } from "../db";
import { evaluatePromotionGate } from "@shared/agentRuntime";
import { getExecutionBackendRegistry } from "../backends/registry";
import type { ExecutionRequest } from "@shared/executionBackend";

export type ApprovalInput = {
  userId: number;
  proposalId: string;
  simulationPassed: boolean;
  ownerPauseActive: boolean;
  lineageCoverage: number; // 0-1
  complexityPenalty: number; // 0-1
  rationale: string;
};

export type ApprovalResult = {
  approved: boolean;
  reason: string;
  gate?: {
    state: "pass" | "review" | "block";
    reason: string;
  };
};

export type ExecutionInput = {
  userId: number;
  proposalId: string;
  // Additional execution context from proposal record
};

export type ExecutionOrchestratorResult = {
  status: "approved" | "rejected";
  proposalId: string;
  reason: string;
  detail?: string;
};

/**
 * Evaluate a proposal for owner approval.
 * Applies hard evaluation gate (policy + evidence + complexity).
 * Does NOT execute; just approves for execution.
 */
export async function evaluateProposalApproval(input: ApprovalInput): Promise<ApprovalResult> {
  const proposal = await getAgentProposal(input.userId, input.proposalId);
  
  if (!proposal) {
    return {
      approved: false,
      reason: "Proposal not found.",
    };
  }

  if (proposal.status !== "review" || proposal.policyResult !== "pass") {
    return {
      approved: false,
      reason: "Only a policy-passing proposal awaiting review can be approved.",
    };
  }

  // Apply hard evaluation gate
  const gate = evaluatePromotionGate({
    policyResult: proposal.policyResult,
    simulationPassed: input.simulationPassed,
    ownerPauseActive: input.ownerPauseActive,
    lineageCoverage: input.lineageCoverage,
    complexityPenalty: input.complexityPenalty,
  });

  return {
    approved: gate.state === "pass",
    reason: gate.reason,
    gate,
  };
}

/**
 * Execute an approved proposal through the configured backend.
 * 
 * Steps:
 *   1. Load proposal + authority state
 *   2. Get configured execution backend
 *   3. Submit order through backend
 *   4. Record result + audit trail
 *   5. Update proposal status
 */
export async function executeApprovedProposal(input: ExecutionInput): Promise<ExecutionOrchestratorResult> {
  const proposal = await getAgentProposal(input.userId, input.proposalId);  if (!proposal) {
    return {
      status: "rejected",
      proposalId: input.proposalId,
      reason: "Proposal not found.",
    };
  }

  if (proposal.status !== "approved") {
    return {
      status: "rejected",
      proposalId: input.proposalId,
      reason: "Only an owner-approved proposal can be executed.",
    };
  }

  try {
    // Get authority state
    const authorityState = await getAuthorityState(input.userId);

    // Load mandate (server-side, not client-supplied)
    const mandates = await listWalletMandates(input.userId);
    const mandate = mandates.find((m: any) => m.walletRole === proposal.walletRole && m.venue === proposal.venue);

    // Extract order details from proposal.action
    let symbol = "UNKNOWN";
    let strategyId: string | undefined;
    if (
      typeof proposal.action === "object" && proposal.action !== null &&
      "kind" in proposal.action && proposal.action.kind === "token_research_paper_proposal" &&
      "address" in proposal.action
    ) {
      // Token research proposal: use the token address
      // TODO: In Phase 2+, resolve token address → symbol via on-chain call
      symbol = String(proposal.action.address).slice(0, 42);
      strategyId = String(proposal.action.address);
    }

    // Get active backend
    const backendRegistry = getExecutionBackendRegistry();
    const backend = backendRegistry.active();
    await backend.verify();

    // Build execution request
    const executionRequest: ExecutionRequest = {
      userId: input.userId,
      proposalId: input.proposalId,
      venue: proposal.venue,
      walletRole: proposal.walletRole,
      order: {
        symbol,
        side: "buy", // Default for research proposals; Phase 2 will make this configurable
        quantity: 1, // Placeholder; Phase 2 will drive from mandate + allocation
        limitPrice: undefined, // Phase 2: derive from oracle
      },
      mandate: mandate ?? null,
      authorityState,
      metadata: {
        policyVersion: 1, // TODO: Track policy version in agentProposals
        lineageId: proposal.runId ?? undefined,
        strategyId,
      },
    };

    // Execute through backend
    const result = await backend.execute(executionRequest);

    // Determine success vs failure from result variant
    const isSuccess = result.status === "filled" || result.status === "submitted";
    const resultReason = "reason" in result ? result.reason : result.status;

    // Record result
    await createOperatorAction(input.userId, {
      actionId: nanoid(),
      kind: "simulation_settled",
      status: isSuccess ? "success" : "blocked",
      subject: `Execution: ${proposal.title}`,
      detail: `Order submitted to ${backend.label}: ${resultReason}`,
      payload: {
        proposalId: input.proposalId,
        backend: backend.type,
        executionResult: result,
      },
    });

    // Update proposal status
    const nextStatus = isSuccess ? "simulated" : "rejected";

    await updateAgentProposalStatus(input.userId, input.proposalId, nextStatus);

    // Record awareness
    await createAwarenessRecord(input.userId, {
      layer: "result",
      subject: `Execution: ${proposal.title}`,
      runId: proposal.runId ?? undefined,
      evidence: [`backend:${backend.type}`, `status:${result.status}`, `venue:${proposal.venue}`],
      summary: `Order submitted through ${backend.label}: ${resultReason}`,
    });

    return {
      status: isSuccess ? "approved" : "rejected",
      proposalId: input.proposalId,
      reason: resultReason,
      detail: `Execution result: ${result.status}`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Execution failed";

    await createOperatorAction(input.userId, {
      actionId: nanoid(),
      kind: "simulation_blocked",
      status: "blocked",
      subject: `Execution failed: ${proposal.title}`,
      detail: reason,
      payload: { proposalId: input.proposalId },
    });

    return {
      status: "rejected",
      proposalId: input.proposalId,
      reason,
    };
  }
}
