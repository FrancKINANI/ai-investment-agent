import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOperatorAction } from "./db";
import { composeSpecialistOutput } from "./agentFabric";
import { createAgentMessage, createConversation, createEvolutionEvent, ensureProtectedAgentNodes, listAgentMessages } from "./agentFabricDb";
import { createAgentMemoryAction, createAgentMemoryEntry, createIndividualAgentConversation, getIndividualAgentConversation, getMemoryEntry, listIndividualAgentConversations, listMemoryWorkspace, touchIndividualAgentConversation, updateMemoryEntry } from "./agentMemoryDb";
import { protectedProcedure, router } from "./_core/trpc";
import { assertMemoryContentIsSafe, canPromoteMemory, formatMemoryContext, memoryKinds, memoryScopes, selectMemoryContext } from "@shared/agentMemory";

const agentIdSchema = z.string().trim().min(1).max(64);
const memoryStatusSchema = z.enum(["active", "pending_promotion", "superseded", "expired", "redacted"]);
const individualMessageSchema = z.object({ targetAgentId: agentIdSchema, threadId: z.string().trim().min(1).max(64).optional(), message: z.string().trim().min(2).max(4_000) });
const memoryCreateSchema = z.object({ scope: z.enum(memoryScopes), agentId: agentIdSchema.optional(), kind: z.enum(memoryKinds), content: z.string().trim().min(2).max(3_000), pinned: z.boolean().default(false), expiresInDays: z.number().int().min(1).max(365).optional() });
const memoryPromotionReviewSchema = z.object({ memoryId: agentIdSchema, decision: z.enum(["approved", "rejected"]), reason: z.string().trim().min(8).max(600) });

function requireOwnerAdmin(role: "user" | "admin") {
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator can approve a shared-memory promotion." });
}

async function requireActiveResearchAgent(userId: number, targetAgentId: string) {
  const nodes = await ensureProtectedAgentNodes(userId);
  const target = nodes.find((node) => node.agentId === targetAgentId);
  if (!target || target.state !== "active") throw new TRPCError({ code: "NOT_FOUND", message: "The selected active agent was not found for this owner." });
  if (target.roleKey === "execution") throw new TRPCError({ code: "FORBIDDEN", message: "The execution role cannot receive direct conversations or memory context." });
  return target;
}

function digest(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function memoryView(entry: Awaited<ReturnType<typeof listMemoryWorkspace>>["entries"][number]) {
  return { ...entry, contextEligible: entry.status === "active" && (!entry.expiresAt || new Date(entry.expiresAt).getTime() > Date.now()), preview: entry.content.slice(0, 180) };
}

export const agentMemoryRouter = router({
  conversations: protectedProcedure.input(z.object({ agentId: agentIdSchema })).query(async ({ ctx, input }) => {
    const target = await requireActiveResearchAgent(ctx.user.id, input.agentId);
    return listIndividualAgentConversations(ctx.user.id, target.agentId);
  }),

  workspace: protectedProcedure.input(z.object({ agentId: agentIdSchema })).query(async ({ ctx, input }) => {
    const target = await requireActiveResearchAgent(ctx.user.id, input.agentId);
    const workspace = await listMemoryWorkspace(ctx.user.id, target.agentId);
    return { agent: { agentId: target.agentId, name: target.name, roleKey: target.roleKey, model: target.model }, entries: workspace.entries.map(memoryView), actions: workspace.actions };
  }),

  create: protectedProcedure.input(memoryCreateSchema).mutation(async ({ ctx, input }) => {
    const content = assertMemoryContentIsSafe(input.content);
    const target = input.scope === "private" ? await requireActiveResearchAgent(ctx.user.id, input.agentId ?? "") : null;
    if (input.scope === "private" && !target) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose an active agent for private memory." });
    if (input.scope === "shared" && input.agentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Shared memory cannot be assigned to one agent." });
    const memoryId = nanoid();
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
    const entry = await createAgentMemoryEntry(ctx.user.id, { memoryId, scope: input.scope, agentId: target?.agentId ?? null, kind: input.kind, content, contentDigest: digest(content), sourceType: "owner_entry", pinned: input.pinned, expiresAt, createdBy: "owner" });
    if (!entry) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Memory could not be saved." });
    await createAgentMemoryAction(ctx.user.id, { actionId: nanoid(), memoryId, action: "created", actorType: "owner", toScope: entry.scope, toStatus: entry.status, payload: { kind: entry.kind, pinned: entry.pinned, sourceType: entry.sourceType } });
    await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "owner_note", status: "success", subject: `Memory created: ${entry.kind}`, detail: entry.scope === "shared" ? "Owner saved team-shared research context." : `Owner saved private research context for ${target?.name ?? "the selected agent"}.`, payload: { memoryId, scope: entry.scope, agentId: entry.agentId, kind: entry.kind, executionBoundary: "sealed" } });
    return memoryView(entry);
  }),

  requestPromotion: protectedProcedure.input(z.object({ memoryId: agentIdSchema, reason: z.string().trim().min(8).max(600) })).mutation(async ({ ctx, input }) => {
    const entry = await getMemoryEntry(ctx.user.id, input.memoryId);
    if (!entry || !canPromoteMemory(entry)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only an active private memory can be proposed for sharing." });
    const updated = await updateMemoryEntry(ctx.user.id, entry.memoryId, { status: "pending_promotion", revision: entry.revision + 1 });
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The memory promotion request could not be recorded." });
    await createAgentMemoryAction(ctx.user.id, { actionId: nanoid(), memoryId: entry.memoryId, action: "promotion_requested", actorType: "owner", fromScope: entry.scope, toScope: entry.scope, fromStatus: entry.status, toStatus: "pending_promotion", reason: input.reason, payload: { revision: updated.revision } });
    await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "owner_note", status: "review", subject: "Private memory proposed for team sharing", detail: "Owner requested review of a private agent memory. It remains private until an administrator approves the promotion.", payload: { memoryId: entry.memoryId, agentId: entry.agentId, executionBoundary: "sealed" } });
    return memoryView(updated);
  }),

  reviewPromotion: protectedProcedure.input(memoryPromotionReviewSchema).mutation(async ({ ctx, input }) => {
    requireOwnerAdmin(ctx.user.role);
    const entry = await getMemoryEntry(ctx.user.id, input.memoryId);
    if (!entry || entry.status !== "pending_promotion" || entry.scope !== "private") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a pending private-memory promotion can be reviewed." });
    const approved = input.decision === "approved";
    const updated = await updateMemoryEntry(ctx.user.id, entry.memoryId, approved ? { scope: "shared", agentId: null, status: "active", revision: entry.revision + 1 } : { status: "active", revision: entry.revision + 1 });
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The memory promotion review could not be recorded." });
    await createAgentMemoryAction(ctx.user.id, { actionId: nanoid(), memoryId: entry.memoryId, action: approved ? "promotion_approved" : "promotion_rejected", actorType: "owner", fromScope: entry.scope, toScope: updated.scope, fromStatus: entry.status, toStatus: updated.status, reason: input.reason, payload: { revision: updated.revision } });
    await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "owner_note", status: approved ? "success" : "review", subject: approved ? "Private memory shared with team" : "Private memory promotion declined", detail: approved ? "Administrator approved an owner-requested memory promotion. The record now appears as team-shared research context." : "Administrator declined a memory promotion. The record remains private to its original agent.", payload: { memoryId: entry.memoryId, approved, executionBoundary: "sealed" } });
    return memoryView(updated);
  }),

  sendIndividualMessage: protectedProcedure.input(individualMessageSchema).mutation(async ({ ctx, input }) => {
    const target = await requireActiveResearchAgent(ctx.user.id, input.targetAgentId);
    const existing = input.threadId ? await getIndividualAgentConversation(ctx.user.id, input.threadId) : null;
    if (input.threadId && (!existing || existing.targetAgentId !== target.agentId)) throw new TRPCError({ code: "FORBIDDEN", message: "This conversation does not belong to the selected agent." });
    const threadId = existing?.threadId ?? nanoid();
    if (!existing) await createIndividualAgentConversation(ctx.user.id, { threadId, targetAgentId: target.agentId, title: `${target.name}: ${input.message.slice(0, 112)}` });
    const history = (await listAgentMessages(ctx.user.id, threadId)).slice(-20).map((message) => ({ actor: message.actor, content: message.content }));
    const workspace = await listMemoryWorkspace(ctx.user.id, target.agentId);
    const context = selectMemoryContext(workspace.entries, target.agentId);
    await createAgentMessage(ctx.user.id, { messageId: nanoid(), threadId, actor: "owner", content: input.message, evidence: ["owner-message", `target-agent:${target.agentId}`, "execution-sealed"] });
    await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), threadId, agentId: target.agentId, state: "working", summary: `${target.name} is preparing a bounded response using the selected memory context.`, evidence: ["individual-agent-conversation", `memory-items:${context.length}`, "execution-sealed"] });
    const result = await composeSpecialistOutput({ model: target.model, role: target.roleKey, name: target.name, message: input.message, history, userId: ctx.user.id, memoryContext: formatMemoryContext(context) });
    await createAgentMessage(ctx.user.id, { messageId: nanoid(), threadId, actor: "agent", agentId: target.agentId, content: result.output, evidence: ["individual-agent-response", `memory-items:${context.length}`, "execution-sealed"] });
    await touchIndividualAgentConversation(ctx.user.id, threadId);
    await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), threadId, agentId: target.agentId, state: "completed", summary: `${target.name} completed a bounded individual research response.`, evidence: ["individual-agent-conversation", "execution-sealed"] });
    await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "chat_message", status: "success", subject: `Owner message to ${target.name}`, detail: "Owner initiated a focused research conversation. No execution authority was granted.", payload: { threadId, targetAgentId: target.agentId, memoryItemCount: context.length, executionBoundary: "sealed" } });
    return { threadId, targetAgentId: target.agentId, reply: result.output, memoryContext: context.map((entry) => ({ memoryId: entry.memoryId, scope: entry.scope, kind: entry.kind })) };
  }),
});
