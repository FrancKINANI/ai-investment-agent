/**
 * Ledgerline agent contracts. These types deliberately separate model selection,
 * tool access, policy evaluation, and execution authority.
 */
export type AgentRole = "research" | "onchain" | "risk" | "allocator" | "supervisor";
export type ToolScope = "market.read" | "portfolio.read" | "chain.read" | "proposal.write" | "execution.request";
export type PolicyResult = "pass" | "review" | "block";

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
  research: { label: "Research agent", defaultTools: ["market.read", "proposal.write"] },
  onchain: { label: "On-chain observer", defaultTools: ["chain.read", "portfolio.read", "proposal.write"] },
  risk: { label: "Risk sentinel", defaultTools: ["portfolio.read", "chain.read", "proposal.write"] },
  allocator: { label: "Allocation planner", defaultTools: ["market.read", "portfolio.read", "proposal.write"] },
  supervisor: { label: "Trajectory supervisor", defaultTools: ["portfolio.read", "proposal.write"] },
};

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
