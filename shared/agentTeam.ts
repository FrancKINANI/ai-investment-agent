import { z } from "zod";
import { loadYamlFile } from "./configFiles";

const providerSchema = z.enum(["openai", "anthropic", "google", "custom"]);
const toolSchema = z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write"]);

export const agentTeamMemberSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(2).max(120),
  layer: z.string().min(2).max(40),
  enabled: z.boolean(),
  delegate: z.boolean(),
  canVeto: z.boolean(),
  canExecute: z.boolean(),
  capabilities: z.array(z.string().regex(/^[a-z0-9.-]+$/)).min(1),
  tools: z.array(toolSchema).min(1),
  aliases: z.array(z.string().regex(/^[a-z0-9_-]+$/)).optional(),
  parent: z.string().regex(/^[a-z0-9_-]+$/).optional(),
  debate: z.enum(["bull", "bear"]).optional(),
  provider: providerSchema.optional(),
  model: z.string().min(1).max(160).optional(),
});

export const agentTeamSchema = z.object({
  schemaVersion: z.literal(1),
  defaultModel: z.string().min(1),
  defaultProvider: providerSchema,
  agents: z.array(agentTeamMemberSchema).min(1),
});

export type AgentTeamMember = z.infer<typeof agentTeamMemberSchema>;
export type AgentTeam = z.infer<typeof agentTeamSchema>;

let cached: AgentTeam | null = null;

export function loadAgentTeam(): AgentTeam {
  if (cached) return cached;
  cached = agentTeamSchema.parse(loadYamlFile("agents/team.yaml"));
  return cached;
}

export function reloadAgentTeam(): AgentTeam {
  cached = null;
  return loadAgentTeam();
}

export function listProtectedTeamRoles() {
  return loadAgentTeam().agents.map((agent) => ({
    roleKey: agent.id,
    name: agent.name,
    layer: agent.layer,
    tools: agent.tools,
    aliases: agent.aliases ?? [],
    enabled: agent.enabled,
    delegate: agent.delegate,
    canVeto: agent.canVeto,
    canExecute: agent.canExecute,
    capabilities: agent.capabilities,
    parent: agent.parent,
    debate: agent.debate,
    provider: agent.provider,
    model: agent.model,
  }));
}

export function findTeamRole(roleKey: string) {
  return loadAgentTeam().agents.find((agent) => agent.id === roleKey || (agent.aliases ?? []).includes(roleKey));
}

export function isProtectedTeamRole(roleKey: string) {
  return Boolean(findTeamRole(roleKey));
}

export function delegationRoleKeys() {
  return loadAgentTeam().agents.filter((agent) => agent.enabled && agent.delegate).map((agent) => agent.id);
}

export function roleMatches(nodeRoleKey: string, wanted: string) {
  const wantedRole = findTeamRole(wanted);
  if (!wantedRole) return nodeRoleKey === wanted;
  return nodeRoleKey === wantedRole.id || (wantedRole.aliases ?? []).includes(nodeRoleKey);
}
