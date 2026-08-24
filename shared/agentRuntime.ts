/**
 * Ledgerline agent contracts. These types deliberately separate model selection,
 * tool access, policy evaluation, and execution authority.
 */
export type AgentRole = "macro" | "onchain" | "variation" | "risk" | "evaluator" | "decision" | "supervisor";
export type ToolScope = "market.read" | "portfolio.read" | "chain.read" | "proposal.write" | "execution.request";
export type PolicyResult = "pass" | "review" | "block";
export type AwarenessLayer = "action" | "justification" | "result" | "evolutionary";
export type PromotionStage = "research" | "simulation" | "decision" | "retired";

export type AgentProfile = {
  id: string;
  name: string;
  role: AgentRole;
  provider: "openai" | "anthropic" | "google" | "custom";
  model: string;
  tools: ToolScope[];
  state: "active" | "paused" | "review";
};

export type ProposalInput = {
  policyResult: PolicyResult;
  simulationOnly: boolean;
  ownerPauseActive: boolean;
  requestedScope: ToolScope;
};

export type ProposalDecision = {
  status: "allowed" | "review" | "blocked";
  reason: string;
};

export const agentRoles: Record<AgentRole, { label: string; defaultTools: ToolScope[] }> = {
  macro: { label: "Macro / regime agent", defaultTools: ["market.read", "proposal.write"] },
  onchain: { label: "On-chain observer", defaultTools: ["chain.read", "portfolio.read", "proposal.write"] },
  variation: { label: "Strategy variation agent", defaultTools: ["market.read", "portfolio.read", "proposal.write"] },
  risk: { label: "Risk agent", defaultTools: ["portfolio.read", "chain.read", "proposal.write"] },
  evaluator: { label: "Evaluator agent", defaultTools: ["portfolio.read", "proposal.write"] },
  decision: { label: "Decision agent", defaultTools: ["market.read", "portfolio.read", "proposal.write"] },
  supervisor: { label: "Trajectory supervisor", defaultTools: ["portfolio.read", "proposal.write"] },
};

export type GateInput = {
  policyResult: PolicyResult;
  simulationPassed: boolean;
  ownerPauseActive: boolean;
  lineageCoverage: number;
  complexityPenalty: number;
};

export function evaluatePromotionGate(input: GateInput) {
  if (input.ownerPauseActive) return { state: "block" as const, reason: "Owner pause is active." };
  if (input.policyResult === "block") return { state: "block" as const, reason: "Policy check failed." };
  if (!input.simulationPassed) return { state: "review" as const, reason: "Simulation evidence is incomplete." };
  if (input.lineageCoverage < 0.7) return { state: "review" as const, reason: "Market-regime coverage is below the minimum gate." };
  if (input.complexityPenalty > 0.4) return { state: "review" as const, reason: "Complexity has risen without enough robustness evidence." };
  return { state: "pass" as const, reason: "Eligible for decision-layer review; never live execution." };
}

export function decideProposal(input: ProposalInput): ProposalDecision {
  if (input.ownerPauseActive) {
    return { status: "blocked", reason: "Owner pause is active; no proposal may advance." };
  }
  if (input.policyResult === "block") {
    return { status: "blocked", reason: "The deterministic policy engine rejected the candidate." };
  }
  if (input.requestedScope === "execution.request") {
    return { status: "blocked", reason: "Execution requests are disabled in the simulation-first runtime." };
  }
  if (input.policyResult === "review") {
    return { status: "review", reason: "The candidate is inside a review boundary and needs owner evidence review." };
  }
  if (!input.simulationOnly) {
    return { status: "blocked", reason: "A live execution mode has not been enabled for this runtime." };
  }
  return { status: "allowed", reason: "Proposal may proceed to paper simulation only." };
}
