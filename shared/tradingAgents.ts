import { listProtectedTeamRoles, loadAgentTeam } from "./agentTeam";

export const defaultAgentModel = loadAgentTeam().defaultModel;

export const protectedTradingAgentRoles = listProtectedTeamRoles().map((role) => ({
  roleKey: role.roleKey,
  name: role.name,
  layer: role.layer,
  tools: role.tools,
}));

export type ProtectedTradingAgentRole = (typeof protectedTradingAgentRoles)[number]["roleKey"];
export type AgentNodeState = "active" | "paused" | "retired" | "review";
export type AgentProvider = "openai" | "anthropic" | "google" | "custom";

export const optionalSubagentLimit = 12;

export function isProtectedTradingAgentRole(roleKey: string): roleKey is ProtectedTradingAgentRole {
  return protectedTradingAgentRoles.some((role) => role.roleKey === roleKey);
}

export function isSafeAgentToolScope(scope: string) {
  return ["market.read", "portfolio.read", "chain.read", "proposal.write"].includes(scope);
}
