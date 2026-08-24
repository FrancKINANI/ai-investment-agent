import { and, desc, eq } from "drizzle-orm";
import { agentConversations, agentEvolutionEvents, agentMessages, agentNodes, discoveryFindings, discoverySchedules, watchlistItems, watchlists } from "../drizzle/schema";
import { defaultAgentModel, protectedTradingAgentRoles } from "@shared/tradingAgents";
import { getDb } from "./db";

type Provider = "openai" | "anthropic" | "google" | "custom";

export async function ensureProtectedAgentNodes(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(agentNodes).where(eq(agentNodes.userId, userId));
  const currentRoles = new Set(existing.filter((node) => node.protectedRole).map((node) => node.roleKey));
  const missing = protectedTradingAgentRoles.filter((role) => !currentRoles.has(role.roleKey));
  if (missing.length) {
    await db.insert(agentNodes).values(missing.map((role) => ({
      userId,
      agentId: `core-${userId}-${role.roleKey}`,
      roleKey: role.roleKey,
      name: role.name,
      parentAgentId: null,
      protectedRole: true,
      provider: "openai" as const,
      model: defaultAgentModel,
      toolScopes: [...role.tools],
      state: "active" as const,
    })));
  }
  return db.select().from(agentNodes).where(eq(agentNodes.userId, userId)).orderBy(desc(agentNodes.protectedRole), desc(agentNodes.updatedAt));
}

export async function updateAgentModel(userId: number, agentId: string, provider: Provider, model: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(agentNodes).set({ provider, model, updatedAt: new Date() }).where(and(eq(agentNodes.userId, userId), eq(agentNodes.agentId, agentId)));
  const result = await db.select().from(agentNodes).where(and(eq(agentNodes.userId, userId), eq(agentNodes.agentId, agentId))).limit(1);
  return result[0] ?? null;
}

export async function createOptionalSubagent(userId: number, values: { agentId: string; roleKey: string; name: string; parentAgentId: string; provider: Provider; model: string; toolScopes: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentNodes).values({ userId, ...values, protectedRole: false, state: "active" });
  const result = await db.select().from(agentNodes).where(eq(agentNodes.agentId, values.agentId)).limit(1);
  return result[0];
}

export async function retireOptionalSubagent(userId: number, agentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(agentNodes).where(and(eq(agentNodes.userId, userId), eq(agentNodes.agentId, agentId))).limit(1);
  if (!existing[0] || existing[0].protectedRole) return null;
  await db.update(agentNodes).set({ state: "retired", updatedAt: new Date() }).where(and(eq(agentNodes.userId, userId), eq(agentNodes.agentId, agentId)));
  return existing[0];
}

export async function createConversation(userId: number, values: { threadId: string; title: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentConversations).values({ userId, ...values });
  const result = await db.select().from(agentConversations).where(eq(agentConversations.threadId, values.threadId)).limit(1);
  return result[0];
}

export async function listConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentConversations).where(eq(agentConversations.userId, userId)).orderBy(desc(agentConversations.updatedAt)).limit(20);
}

export async function createAgentMessage(userId: number, values: { messageId: string; threadId: string; actor: "owner" | "supervisor" | "agent" | "system"; agentId?: string; content: string; evidence: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentMessages).values({ userId, ...values, agentId: values.agentId ?? null });
  await db.update(agentConversations).set({ updatedAt: new Date() }).where(and(eq(agentConversations.userId, userId), eq(agentConversations.threadId, values.threadId)));
  const result = await db.select().from(agentMessages).where(eq(agentMessages.messageId, values.messageId)).limit(1);
  return result[0];
}

export async function listAgentMessages(userId: number, threadId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentMessages).where(and(eq(agentMessages.userId, userId), eq(agentMessages.threadId, threadId))).orderBy(agentMessages.createdAt);
}

export async function createEvolutionEvent(userId: number, values: { eventId: string; threadId?: string; agentId?: string; state: "delegated" | "working" | "completed" | "blocked" | "created" | "retired"; summary: string; evidence: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentEvolutionEvents).values({ userId, ...values, threadId: values.threadId ?? null, agentId: values.agentId ?? null });
  const result = await db.select().from(agentEvolutionEvents).where(eq(agentEvolutionEvents.eventId, values.eventId)).limit(1);
  return result[0];
}

export async function listEvolutionEvents(userId: number, threadId?: string) {
  const db = await getDb();
  if (!db) return [];
  const where = threadId ? and(eq(agentEvolutionEvents.userId, userId), eq(agentEvolutionEvents.threadId, threadId)) : eq(agentEvolutionEvents.userId, userId);
  return db.select().from(agentEvolutionEvents).where(where).orderBy(desc(agentEvolutionEvents.createdAt)).limit(80);
}

export async function createWatchlist(userId: number, values: { watchlistId: string; name: string; criteria: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(watchlists).values({ userId, ...values, enabled: true });
  const result = await db.select().from(watchlists).where(eq(watchlists.watchlistId, values.watchlistId)).limit(1);
  return result[0];
}

export async function updateWatchlistCriteria(userId: number, watchlistId: string, criteria: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(watchlists).set({ criteria, updatedAt: new Date() }).where(and(eq(watchlists.userId, userId), eq(watchlists.watchlistId, watchlistId)));
  const result = await db.select().from(watchlists).where(and(eq(watchlists.userId, userId), eq(watchlists.watchlistId, watchlistId))).limit(1);
  return result[0] ?? null;
}

export async function listWatchlists(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlists).where(eq(watchlists.userId, userId)).orderBy(desc(watchlists.updatedAt));
}

export async function createWatchlistItem(userId: number, values: { itemId: string; watchlistId: string; label: string; address?: string; symbol?: string; chain?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(watchlistItems).values({ userId, ...values, address: values.address ?? null, symbol: values.symbol ?? null, chain: values.chain ?? null, status: "watching" });
  const result = await db.select().from(watchlistItems).where(eq(watchlistItems.itemId, values.itemId)).limit(1);
  return result[0];
}

export async function listWatchlistItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(watchlistItems).where(eq(watchlistItems.userId, userId)).orderBy(desc(watchlistItems.updatedAt));
}

export async function deleteWatchlistItem(userId: number, itemId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.select().from(watchlistItems).where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.itemId, itemId))).limit(1);
  if (!result[0]) return null;
  await db.delete(watchlistItems).where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.itemId, itemId)));
  return result[0];
}

export async function updateWatchlistItemStatus(userId: number, itemId: string, status: "watching" | "candidate" | "review" | "blocked") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(watchlistItems).set({ status, updatedAt: new Date() }).where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.itemId, itemId)));
  const result = await db.select().from(watchlistItems).where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.itemId, itemId))).limit(1);
  return result[0] ?? null;
}

export async function createDiscoverySchedule(userId: number, values: { scheduleId: string; cadence: "daily" | "six_hour" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(discoverySchedules).values({ userId, ...values, enabled: false, scheduleCronTaskUid: null });
  const result = await db.select().from(discoverySchedules).where(eq(discoverySchedules.scheduleId, values.scheduleId)).limit(1);
  return result[0];
}

export async function getDiscoverySchedule(userId: number, scheduleId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(discoverySchedules).where(and(eq(discoverySchedules.userId, userId), eq(discoverySchedules.scheduleId, scheduleId))).limit(1);
  return result[0] ?? null;
}

export async function getDiscoveryScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(discoverySchedules).where(eq(discoverySchedules.scheduleCronTaskUid, taskUid)).limit(1);
  return result[0] ?? null;
}

export async function activateDiscoverySchedule(userId: number, scheduleId: string, taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(discoverySchedules).set({ enabled: true, scheduleCronTaskUid: taskUid, updatedAt: new Date() }).where(and(eq(discoverySchedules.userId, userId), eq(discoverySchedules.scheduleId, scheduleId)));
  return getDiscoverySchedule(userId, scheduleId);
}

export async function pauseDiscoverySchedule(userId: number, scheduleId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(discoverySchedules).set({ enabled: false, updatedAt: new Date() }).where(and(eq(discoverySchedules.userId, userId), eq(discoverySchedules.scheduleId, scheduleId)));
  return getDiscoverySchedule(userId, scheduleId);
}

export async function markDiscoveryScheduleRun(scheduleId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(discoverySchedules).set({ lastRunAt: new Date(), updatedAt: new Date() }).where(eq(discoverySchedules.scheduleId, scheduleId));
}

export async function listDiscoverySchedules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discoverySchedules).where(eq(discoverySchedules.userId, userId)).orderBy(desc(discoverySchedules.updatedAt));
}

export async function createDiscoveryFinding(userId: number, values: { findingId: string; scheduleId?: string; watchlistItemId?: string; score: number; confidence: "low" | "medium" | "high"; status: "watching" | "candidate" | "review" | "blocked"; summary: string; evidence: string[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(discoveryFindings).values({ userId, ...values, scheduleId: values.scheduleId ?? null, watchlistItemId: values.watchlistItemId ?? null });
  const result = await db.select().from(discoveryFindings).where(eq(discoveryFindings.findingId, values.findingId)).limit(1);
  return result[0];
}

export async function getDiscoveryFindingById(findingId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(discoveryFindings).where(eq(discoveryFindings.findingId, findingId)).limit(1);
  return result[0] ?? null;
}

export async function listDiscoveryFindings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discoveryFindings).where(eq(discoveryFindings.userId, userId)).orderBy(desc(discoveryFindings.createdAt)).limit(50);
}
