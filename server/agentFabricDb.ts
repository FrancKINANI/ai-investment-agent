import { and, desc, eq } from "drizzle-orm";
import { agentConversations, agentEvolutionEvents, agentMessages, agentNodes, discoveryFindings, discoverySchedules, watchlistItems, watchlists } from "../drizzle/schema";
import { findTeamRole, listProtectedTeamRoles, loadAgentTeam } from "@shared/agentTeam";
import { defaultAgentModel } from "@shared/tradingAgents";
import { getDb } from "./db";

type Provider = "openai" | "anthropic" | "google" | "custom";

export async function ensureProtectedAgentNodes(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const team = loadAgentTeam();
  const existing = await db.select().from(agentNodes).where(eq(agentNodes.userId, userId));
  const currentRoles = new Set(existing.filter((node) => node.protectedRole).map((node) => node.roleKey));
  const missing = listProtectedTeamRoles().filter((role) => {
    if (currentRoles.has(role.roleKey)) return false;
    return !role.aliases.some((alias) => currentRoles.has(alias));
  });
  if (missing.length) {
    await db.insert(agentNodes).values(missing.map((role) => ({
      userId,
      agentId: `core-${userId}-${role.roleKey}`,
      roleKey: role.roleKey,
      name: role.name,
      parentAgentId: role.parent ? `core-${userId}-${role.parent}` : null,
      protectedRole: true,
      provider: (role.provider ?? team.defaultProvider) as Provider,
      model: role.model ?? defaultAgentModel,
      toolScopes: [...role.tools],
      state: role.enabled ? "active" as const : "paused" as const,
    })));
  }
  for (const node of existing.filter((item) => item.protectedRole)) {
    const spec = findTeamRole(node.roleKey);
    if (!spec) continue;
    const nextState = spec.enabled ? (node.state === "paused" ? "active" : node.state) : "paused";
    if (nextState !== node.state) {
      await db.update(agentNodes).set({ state: nextState, updatedAt: new Date() }).where(and(eq(agentNodes.userId, userId), eq(agentNodes.agentId, node.agentId)));
    }
  }
  return db.select().from(agentNodes).where(eq(agentNodes.userId, userId)).orderBy(desc(agentNodes.protectedRole), desc(agentNodes.updatedAt));
}
