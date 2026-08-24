export const protectedTradingAgentRoles = [
  { roleKey: "supervisor", name: "Supervisor", layer: "coordination", tools: ["market.read", "chain.read", "proposal.write"] },
  { roleKey: "fundamental", name: "Fundamental analyst", layer: "analysts", tools: ["market.read", "chain.read"] },
  { roleKey: "sentiment", name: "Sentiment analyst", layer: "analysts", tools: ["market.read"] },
  { roleKey: "technical", name: "Technical analyst", layer: "analysts", tools: ["market.read"] },
  { roleKey: "news", name: "News analyst", layer: "analysts", tools: ["market.read"] },
  { roleKey: "bull", name: "Bull researcher", layer: "research", tools: ["market.read", "chain.read"] },
  { roleKey: "bear", name: "Bear researcher", layer: "research", tools: ["market.read", "chain.read"] },
  { roleKey: "trader", name: "Trader", layer: "decision", tools: ["market.read", "portfolio.read", "proposal.write"] },
  { roleKey: "risk_guardians", name: "Risk guardians", layer: "risk", tools: ["market.read", "portfolio.read", "chain.read"] },
  { roleKey: "fund_manager", name: "Fund manager", layer: "approval", tools: ["portfolio.read", "proposal.write"] },
] as const;

export type ProtectedTradingAgentRole = (typeof protectedTradingAgentRoles)[number]["roleKey"];
export type AgentNodeState = "active" | "paused" | "retired" | "review";
export type AgentProvider = "openai" | "anthropic" | "google" | "custom";

export const defaultAgentModel = "gpt-5-mini";
export const optionalSubagentLimit = 12;

export function isProtectedTradingAgentRole(roleKey: string): roleKey is ProtectedTradingAgentRole {
  return protectedTradingAgentRoles.some((role) => role.roleKey === roleKey);
}

export function isSafeAgentToolScope(scope: string) {
  return ["market.read", "portfolio.read", "chain.read", "proposal.write"].includes(scope);
}
