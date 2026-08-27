import { and, desc, eq, or } from "drizzle-orm";
import { agentIndividualConversations, agentMemoryActions, agentMemoryEntries } from "../drizzle/schema";
import { getDb } from "./db";

export async function getIndividualAgentConversation(userId: number, threadId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(agentIndividualConversations).where(and(eq(agentIndividualConversations.userId, userId), eq(agentIndividualConversations.threadId, threadId))).limit(1);
  return rows[0] ?? null;
}

export async function createIndividualAgentConversation(userId: number, values: { threadId: string; targetAgentId: string; title: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentIndividualConversations).values({ userId, ...values });
  return getIndividualAgentConversation(userId, values.threadId);
}

export async function listIndividualAgentConversations(userId: number, targetAgentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(agentIndividualConversations).where(and(eq(agentIndividualConversations.userId, userId), eq(agentIndividualConversations.targetAgentId, targetAgentId))).orderBy(desc(agentIndividualConversations.updatedAt)).limit(20);
}

export async function touchIndividualAgentConversation(userId: number, threadId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(agentIndividualConversations).set({ updatedAt: new Date() }).where(and(eq(agentIndividualConversations.userId, userId), eq(agentIndividualConversations.threadId, threadId)));
}

export async function listMemoryWorkspace(userId: number, agentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const entries = await db.select().from(agentMemoryEntries).where(and(
    eq(agentMemoryEntries.userId, userId),
    or(eq(agentMemoryEntries.scope, "shared"), and(eq(agentMemoryEntries.scope, "private"), eq(agentMemoryEntries.agentId, agentId))),
  )).orderBy(desc(agentMemoryEntries.pinned), desc(agentMemoryEntries.updatedAt)).limit(80);
  const visibleMemoryIds = new Set(entries.map((entry) => entry.memoryId));
  const actions = (await db.select().from(agentMemoryActions).where(eq(agentMemoryActions.userId, userId)).orderBy(desc(agentMemoryActions.createdAt)).limit(160))
    .filter((action) => visibleMemoryIds.has(action.memoryId));
  return { entries, actions };
}

export async function createAgentMemoryEntry(userId: number, values: {
  memoryId: string;
  scope: "shared" | "private";
  agentId?: string | null;
  kind: "owner_instruction" | "constraint" | "verified_fact" | "research_note" | "question" | "decision" | "source_reference";
  content: string;
  contentDigest: string;
  sourceType: "owner_entry" | "conversation" | "watchlist" | "policy" | "activity";
  sourceRef?: string | null;
  pinned: boolean;
  expiresAt?: Date | null;
  createdBy: "owner" | "agent" | "system";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentMemoryEntries).values({ userId, ...values, agentId: values.agentId ?? null, sourceRef: values.sourceRef ?? null, expiresAt: values.expiresAt ?? null, status: "active", revision: 1 });
  const rows = await db.select().from(agentMemoryEntries).where(and(eq(agentMemoryEntries.userId, userId), eq(agentMemoryEntries.memoryId, values.memoryId))).limit(1);
  return rows[0] ?? null;
}

export async function getMemoryEntry(userId: number, memoryId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(agentMemoryEntries).where(and(eq(agentMemoryEntries.userId, userId), eq(agentMemoryEntries.memoryId, memoryId))).limit(1);
  return rows[0] ?? null;
}

export async function updateMemoryEntry(userId: number, memoryId: string, patch: Partial<{
  scope: "shared" | "private";
  agentId: string | null;
  status: "active" | "pending_promotion" | "superseded" | "expired" | "redacted";
  pinned: boolean;
  expiresAt: Date | null;
  revision: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(agentMemoryEntries).set(patch).where(and(eq(agentMemoryEntries.userId, userId), eq(agentMemoryEntries.memoryId, memoryId)));
  return getMemoryEntry(userId, memoryId);
}

export async function createAgentMemoryAction(userId: number, values: {
  actionId: string;
  memoryId: string;
  action: "created" | "promotion_requested" | "promotion_approved" | "promotion_rejected" | "retired" | "redacted";
  actorType: "owner" | "agent" | "system";
  actorAgentId?: string | null;
  fromScope?: "shared" | "private" | null;
  toScope?: "shared" | "private" | null;
  fromStatus?: "active" | "pending_promotion" | "superseded" | "expired" | "redacted" | null;
  toStatus?: "active" | "pending_promotion" | "superseded" | "expired" | "redacted" | null;
  reason?: string | null;
  payload: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentMemoryActions).values({ userId, ...values, actorAgentId: values.actorAgentId ?? null, fromScope: values.fromScope ?? null, toScope: values.toScope ?? null, fromStatus: values.fromStatus ?? null, toStatus: values.toStatus ?? null, reason: values.reason ?? null });
}
