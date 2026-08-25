import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { decideProposal, evaluatePromotionGate } from "@shared/agentRuntime";
import { getSessionCookieOptions } from "./_core/cookies";
import { listLLMModels } from "./_core/llm";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAgentProposal, createAgentRun, createAwarenessRecord, createBindingChangeRequest, createOperatorAction, createOutcomeRecord, createStrategyEvaluation, createStrategyLineage, createVenueConnection, createWalletMandate, getAgentProposal, getBindingChangeRequest, getInvestmentPolicy, listAgentProfiles, listAgentProposals, listAgentRuns, listAwarenessRecords, listBindingChangeRequests, listOperatorActions, listOutcomeRecords, listStrategyEvaluations, listStrategyLineages, listVenueConnections, listWalletMandates, reviewBindingChangeRequest, saveInvestmentPolicy, updateAgentProposalStatus, updateWalletMandateMode } from "./db";
import { getEthereumTokenMetrics } from "./onchain";
import { ethereumAddressSchema, investmentPolicySchema, normalizeInvestmentPolicy } from "@shared/ips";
import { researchRequestSchema, runTokenResearch } from "./research";
import { calculateResearchNoteConfidence, composeFundManagerDisagreementSummary, composeSpecialistOutput, composeSupervisorReply, defaultDelegation } from "./agentFabric";
import { activateDiscoverySchedule, createAgentMessage, createConversation, createEvolutionEvent, createOptionalSubagent, createWatchlist, createWatchlistItem, createDiscoverySchedule, deleteWatchlistItem, ensureProtectedAgentNodes, getDiscoverySchedule, listAgentMessages, listConversations, listDiscoveryFindings, listDiscoverySchedules, listEvolutionEvents, listWatchlistItems, listWatchlists, pauseDiscoverySchedule, retireOptionalSubagent, updateAgentModel, updateWatchlistCriteria, updateWatchlistItemStatus } from "./agentFabricDb";
import { defaultAgentModel, isSafeAgentToolScope, optionalSubagentLimit } from "@shared/tradingAgents";
import { capabilityBindingDraftSchema, getCapabilityRegistrySummary, validateCapabilityBindingDraft } from "@shared/capabilityRegistry";
import { getPhase0ConfigurationSummary } from "./phase0Config";

const proposalSchema = z.object({
  policyResult: z.enum(["pass", "review", "block"]),
  simulationOnly: z.boolean(),
  ownerPauseActive: z.boolean(),
  requestedScope: z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write", "execution.request"]),
});

const actionSchema = z.object({
  kind: z.enum(["policy_updated", "simulation_started", "simulation_blocked", "onchain_viewed", "scope_checked", "outcome_recorded", "promotion_changed", "research_completed", "agent_configured", "subagent_created", "subagent_retired", "chat_message", "watchlist_created", "watchlist_updated", "discovery_schedule_configured", "discovery_completed"]),
  status: z.enum(["success", "review", "blocked"]),
  subject: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(2000),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const lineageSchema = z.object({
  lineageId: z.string().trim().min(3).max(64),
  name: z.string().trim().min(2).max(160),
  stage: z.enum(["research", "simulation", "decision", "retired"]),
  generation: z.number().int().positive().max(10_000),
  parentVersion: z.string().trim().max(64).optional(),
  rationale: z.string().trim().min(5).max(4_000),
});

const evaluationSchema = z.object({
  lineageId: z.string().trim().min(3).max(64),
  version: z.string().trim().min(1).max(64),
  gateResult: z.enum(["pass", "review", "block"]),
  simulationPassed: z.boolean(),
  coverage: z.number().int().min(0).max(100),
  complexityPenalty: z.number().int().min(0).max(100),
  rationale: z.string().trim().min(5).max(4_000),
});

const outcomeSchema = z.object({
  lineageId: z.string().trim().min(3).max(64),
  runId: z.string().trim().max(64).optional(),
  expectedBps: z.number().int().min(-100_000).max(100_000),
  realizedBps: z.number().int().min(-100_000).max(100_000).optional(),
  deviation: z.enum(["on_track", "underperforming", "outperforming", "inconclusive"]),
  narrative: z.string().trim().min(5).max(4_000),
});

const venueSchema = z.enum(["binance", "evm", "polymarket"]);
const walletRoleSchema = z.enum(["trading", "investment"]);
const mandateCreateSchema = z.object({
  walletRole: walletRoleSchema,
  venue: venueSchema,
  allowedAssets: z.array(z.string().trim().min(1).max(160)).min(1).max(50),
  maxOrderBps: z.number().int().min(1).max(10_000),
  dailyCapBps: z.number().int().min(1).max(10_000),
});
const connectionCreateSchema = z.object({ venue: venueSchema, capabilities: z.array(z.string().trim().min(1).max(80)).min(1).max(12) });
const providerSchema = z.enum(["openai", "anthropic", "google", "custom"]);
const modelRouteSchema = z.object({ agentId: z.string().trim().min(1).max(64), provider: providerSchema, model: z.string().trim().min(1).max(160) });
const optionalSubagentSchema = z.object({ parentAgentId: z.string().trim().min(1).max(64), roleKey: z.string().trim().regex(/^[a-z0-9_-]+$/).min(3).max(64), name: z.string().trim().min(3).max(120), provider: providerSchema, model: z.string().trim().min(1).max(160), toolScopes: z.array(z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write"])).min(1).max(4) });
const chatMessageSchema = z.object({ threadId: z.string().trim().min(1).max(64).optional(), message: z.string().trim().min(2).max(4_000) });
const watchlistSchema = z.object({ name: z.string().trim().min(2).max(120) });
const watchlistItemSchema = z.object({ watchlistId: z.string().trim().min(1).max(64), label: z.string().trim().min(2).max(120), address: z.string().trim().max(64).optional(), symbol: z.string().trim().max(32).optional(), chain: z.string().trim().max(32).optional() });
const watchlistScopeSchema = z.object({ watchlistId: z.string().trim().min(1).max(64), chains: z.array(z.enum(["ethereum"])).min(1).max(1), evidenceStandard: z.enum(["strict", "balanced"]) });
const hardGateReviewSchema = z.object({ proposalId: z.string().trim().min(1).max(64), simulationPassed: z.boolean(), lineageCoverage: z.number().int().min(0).max(100), complexityPenalty: z.number().int().min(0).max(100), ownerPauseActive: z.boolean(), rationale: z.string().trim().min(5).max(1_000) });
const bindingChangeRequestSchema = capabilityBindingDraftSchema.extend({ rationale: z.string().trim().min(12).max(1_000) });
const bindingChangeReviewSchema = z.object({ requestId: z.string().trim().min(1).max(64), decision: z.enum(["approved", "rejected"]), reviewNote: z.string().trim().min(8).max(1_000) });

function requireOwnerAdmin(role: "user" | "admin") {
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Only an administrator can validate configuration or hard evaluation gates." });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  agentRuntime: router({
    profiles: protectedProcedure.query(({ ctx }) => listAgentProfiles(ctx.user.id)),
    runs: protectedProcedure.query(({ ctx }) => listAgentRuns(ctx.user.id)),
    evaluateProposal: protectedProcedure.input(proposalSchema).mutation(({ input }) => decideProposal(input)),
    catalog: publicProcedure.query(async () => {
      const { data } = await listLLMModels();
      const modelIds = data.map((model) => model.id);
      const byPrefix = (prefix: string) => modelIds.filter((id) => id.startsWith(prefix));
      return {
        runtime: "provider-agnostic",
        execution: "disabled",
        providers: [
          { id: "openai", label: "OpenAI", models: byPrefix("gpt-") },
          { id: "anthropic", label: "Anthropic", models: byPrefix("claude-") },
          { id: "google", label: "Google", models: byPrefix("gemini-") },
          { id: "custom", label: "MCP / custom", models: ["bring-your-own-agent"] },
        ],
      };
    }),
  }),
  policy: router({
    current: protectedProcedure.query(({ ctx }) => getInvestmentPolicy(ctx.user.id)),
    save: protectedProcedure.input(investmentPolicySchema).mutation(async ({ ctx, input }) => {
      const normalized = normalizeInvestmentPolicy(input);
      const policy = await saveInvestmentPolicy(ctx.user.id, normalized);
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "policy_updated",
        status: "success",
        subject: `IPS ${policy?.name ?? normalized.name}`,
        detail: "Owner updated a simulation-only Investment Policy Statement.",
        payload: { version: policy?.version, allowedAssets: normalized.allowedAssets, executionMode: "simulation" },
      });
      return policy;
    }),
  }),
  agentFabric: router({
    nodes: protectedProcedure.query(({ ctx }) => ensureProtectedAgentNodes(ctx.user.id)),
    capabilityRegistry: protectedProcedure.query(() => getCapabilityRegistrySummary()),
    phase0Configuration: protectedProcedure.query(() => getPhase0ConfigurationSummary()),
    validateCapabilityBinding: protectedProcedure.input(capabilityBindingDraftSchema).mutation(async ({ ctx, input }) => {
      requireOwnerAdmin(ctx.user.role);
      const validation = validateCapabilityBindingDraft(input);
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(), kind: "scope_checked", status: validation.valid ? "review" : "blocked",
        subject: `Binding validation: ${input.capabilityId}`,
        detail: validation.valid ? "Owner validated a staged capability binding. The immutable runtime manifest was not changed." : "Owner attempted an invalid staged capability binding; no runtime authority changed.",
        payload: { binding: validation.normalized, valid: validation.valid, issues: validation.issues, stagedOnly: true },
        capabilityIds: [input.capabilityId],
      });
      return validation;
    }),
    bindingChangeRequests: protectedProcedure.query(({ ctx }) => listBindingChangeRequests(ctx.user.id)),
    requestBindingChange: protectedProcedure.input(bindingChangeRequestSchema).mutation(async ({ ctx, input }) => {
      const validation = validateCapabilityBindingDraft(input);
      if (!validation.valid || !validation.normalized) throw new TRPCError({ code: "PRECONDITION_FAILED", message: validation.issues.join(" ") || "The binding request is invalid." });
      const requestId = nanoid();
      const request = await createBindingChangeRequest(ctx.user.id, { requestId, ...validation.normalized, rationale: input.rationale });
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(), kind: "scope_checked", status: "review",
        subject: `Binding change requested: ${validation.normalized.capabilityId}`,
        detail: "Owner submitted a validated staged binding-change request for administrator review. The active manifest was not changed.",
        payload: { requestId, binding: validation.normalized, rationale: input.rationale, status: "pending", stagedOnly: true, activeManifestChanged: false },
        capabilityIds: [validation.normalized.capabilityId],
      });
      return request;
    }),
    reviewBindingChangeRequest: protectedProcedure.input(bindingChangeReviewSchema).mutation(async ({ ctx, input }) => {
      requireOwnerAdmin(ctx.user.role);
      const current = await getBindingChangeRequest(ctx.user.id, input.requestId);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Binding-change request not found." });
      if (current.status !== "pending") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a pending binding-change request can be reviewed." });
      const validation = validateCapabilityBindingDraft({ capabilityId: current.capabilityId, roleKeys: current.roleKeys, permission: current.permission });
      if (!validation.valid) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `The staged request no longer validates: ${validation.issues.join(" ")}` });
      const reviewed = await reviewBindingChangeRequest(ctx.user.id, input.requestId, ctx.user.id, input.decision, input.reviewNote);
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(), kind: "scope_checked", status: input.decision === "approved" ? "success" : "review",
        subject: `Binding change ${input.decision}: ${current.capabilityId}`,
        detail: input.decision === "approved" ? "Administrator approved a staged binding change for maintainer application. The active manifest remains unchanged." : "Administrator rejected a staged binding change. The active manifest remains unchanged.",
        payload: { requestId: input.requestId, decision: input.decision, reviewNote: input.reviewNote, binding: validation.normalized, stagedOnly: true, activeManifestChanged: false },
        capabilityIds: [current.capabilityId],
      });
      return reviewed;
    }),
    conversations: protectedProcedure.query(({ ctx }) => listConversations(ctx.user.id)),
    messages: protectedProcedure.input(z.object({ threadId: z.string().trim().min(1).max(64) })).query(({ ctx, input }) => listAgentMessages(ctx.user.id, input.threadId)),
    evolution: protectedProcedure.input(z.object({ threadId: z.string().trim().min(1).max(64).optional() })).query(({ ctx, input }) => listEvolutionEvents(ctx.user.id, input.threadId)),
    updateModel: protectedProcedure.input(modelRouteSchema).mutation(async ({ ctx, input }) => {
      const node = await updateAgentModel(ctx.user.id, input.agentId, input.provider, input.model);
      if (!node) throw new TRPCError({ code: "NOT_FOUND", message: "Agent node not found." });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "agent_configured", status: "success", subject: `Model route: ${node.name}`, detail: `Owner assigned ${input.model} to ${node.name}. Tool and execution authority remain unchanged.`, payload: { agentId: node.agentId, provider: input.provider, model: input.model } });
      return node;
    }),
    createOptionalSubagent: protectedProcedure.input(optionalSubagentSchema).mutation(async ({ ctx, input }) => {
      const nodes = await ensureProtectedAgentNodes(ctx.user.id);
      const parent = nodes.find((node) => node.agentId === input.parentAgentId && node.state !== "retired");
      if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Parent agent is not active." });
      const optionalCount = nodes.filter((node) => !node.protectedRole && node.state !== "retired").length;
      if (optionalCount >= optionalSubagentLimit) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Optional subagent capacity is limited to ${optionalSubagentLimit}.` });
      if (!input.toolScopes.every(isSafeAgentToolScope)) throw new TRPCError({ code: "FORBIDDEN", message: "Optional subagents may only receive read and paper-proposal scopes." });
      const node = await createOptionalSubagent(ctx.user.id, { agentId: nanoid(), ...input });
      await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), agentId: node?.agentId, state: "created", summary: `Optional subagent ${input.name} was added beneath ${parent.name}.`, evidence: ["owner-configured", `parent:${parent.agentId}`, "execution-sealed"] });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "subagent_created", status: "success", subject: `Subagent created: ${input.name}`, detail: "A bounded optional subagent was created with simulation-safe scopes.", payload: { agentId: node?.agentId, parentAgentId: input.parentAgentId, toolScopes: input.toolScopes } });
      return node;
    }),
    retireOptionalSubagent: protectedProcedure.input(z.object({ agentId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const node = await retireOptionalSubagent(ctx.user.id, input.agentId);
      if (!node) throw new TRPCError({ code: "FORBIDDEN", message: "Protected roles cannot be deleted and optional subagents must exist before retirement." });
      await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), agentId: node.agentId, state: "retired", summary: `Optional subagent ${node.name} was retired.`, evidence: ["owner-configured", "execution-sealed"] });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "subagent_retired", status: "success", subject: `Subagent retired: ${node.name}`, detail: "The optional subagent was retired; protected roles remain intact.", payload: { agentId: node.agentId } });
      return node;
    }),
    sendSupervisorMessage: protectedProcedure.input(chatMessageSchema).mutation(async ({ ctx, input }) => {
      const nodes = await ensureProtectedAgentNodes(ctx.user.id);
      const supervisor = nodes.find((node) => node.roleKey === "supervisor" && node.protectedRole) ?? nodes[0];
      const fundManager = nodes.find((node) => node.roleKey === "fund_manager" && node.protectedRole);
      if (!supervisor) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supervisor configuration could not be initialized." });
      const threadId = input.threadId ?? nanoid();
      if (!input.threadId) await createConversation(ctx.user.id, { threadId, title: input.message.slice(0, 120) });
      await createAgentMessage(ctx.user.id, { messageId: nanoid(), threadId, actor: "owner", content: input.message, evidence: ["owner-message"] });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "chat_message", status: "success", subject: "Owner message to supervisor", detail: "Owner initiated a simulation-only supervisor conversation.", payload: { threadId } });
      const threadHistory = await listAgentMessages(ctx.user.id, threadId);
      const history = threadHistory.map((message) => ({ actor: message.actor, content: message.content }));
      const delegatedAgents = defaultDelegation.map((roleKey) => nodes.find((node) => node.roleKey === roleKey)).filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));
      for (const agent of delegatedAgents) await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), threadId, agentId: agent.agentId, state: "delegated", summary: `${agent.name} was delegated a bounded research perspective.`, evidence: ["supervisor-delegation", `model:${agent.model}`, "execution-sealed"] });
      const settled = await Promise.allSettled(delegatedAgents.map(async (agent) => ({ agent, output: await composeSpecialistOutput({ model: agent.model || defaultAgentModel, role: agent.roleKey, name: agent.name, message: input.message, history }) })));
      const specialistReports: { role: string; name: string; output: string; confidence?: number }[] = [];
      for (const result of settled) {
        if (result.status === "fulfilled") {
          const { agent, output } = result.value;
          const confidence = agent.roleKey === "bull" || agent.roleKey === "bear" ? calculateResearchNoteConfidence(output) : undefined;
          specialistReports.push({ role: agent.roleKey, name: agent.name, output, confidence });
          await createAgentMessage(ctx.user.id, { messageId: nanoid(), threadId, actor: "agent", agentId: agent.agentId, content: output, confidence, evidence: ["specialist-working-note", `role:${agent.roleKey}`, `model:${agent.model}`, ...(confidence ? ["confidence:research-note-completeness"] : []), "execution-sealed"] });
          await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), threadId, agentId: agent.agentId, state: "completed", summary: `${agent.name} completed a bounded working note.`, evidence: ["specialist-working-note", `model:${agent.model}`, "execution-sealed"] });
        } else {
          await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), threadId, state: "blocked", summary: "A specialist note could not be completed; the supervisor will preserve this uncertainty.", evidence: ["specialist-call-failed", "execution-sealed"] });
        }
      }
      if (fundManager) {
        const disagreementReview = composeFundManagerDisagreementSummary(specialistReports);
        await createAgentMessage(ctx.user.id, { messageId: nanoid(), threadId, actor: "agent", agentId: fundManager.agentId, content: disagreementReview, evidence: ["fund-manager-disagreement-review", "bull-bear-debate", "risk-and-ips-required", "execution-sealed"] });
        await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), threadId, agentId: fundManager.agentId, state: "completed", summary: "Fund Manager recorded a bounded Bull/Bear disagreement review; no execution authority was granted.", evidence: ["fund-manager-disagreement-review", "execution-sealed"] });
      }
      const reply = await composeSupervisorReply({ model: supervisor.model || defaultAgentModel, message: input.message, agentNames: nodes.filter((node) => node.protectedRole).map((node) => node.name), history, specialistReports });
      await createAgentMessage(ctx.user.id, { messageId: nanoid(), threadId, actor: "supervisor", agentId: supervisor.agentId, content: reply, evidence: ["supervisor-synthesis", `model:${supervisor.model}`, "no-live-execution"] });
      await createEvolutionEvent(ctx.user.id, { eventId: nanoid(), threadId, agentId: supervisor.agentId, state: "completed", summary: "Supervisor returned a bounded research synthesis and next safe step.", evidence: ["supervisor-synthesis", `model:${supervisor.model}`, "execution-sealed"] });
      return { threadId, reply };
    }),
  }),
  watchlists: router({
    lists: protectedProcedure.query(async ({ ctx }) => ({ lists: await listWatchlists(ctx.user.id), items: await listWatchlistItems(ctx.user.id), findings: await listDiscoveryFindings(ctx.user.id) })),
    create: protectedProcedure.input(watchlistSchema).mutation(async ({ ctx, input }) => {
      const record = await createWatchlist(ctx.user.id, { watchlistId: nanoid(), name: input.name, criteria: { scope: "owner-defined", execution: "simulation-only" } });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "watchlist_created", status: "success", subject: `Watchlist: ${input.name}`, detail: "Owner created a bounded discovery universe.", payload: { watchlistId: record?.watchlistId } });
      return record;
    }),
    addItem: protectedProcedure.input(watchlistItemSchema).mutation(async ({ ctx, input }) => {
      const record = await createWatchlistItem(ctx.user.id, { itemId: nanoid(), ...input });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "watchlist_updated", status: "success", subject: `Watchlist item: ${input.label}`, detail: "Owner added an asset to the bounded discovery universe.", payload: { itemId: record?.itemId, watchlistId: input.watchlistId } });
      return record;
    }),
    removeItem: protectedProcedure.input(z.object({ itemId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const record = await deleteWatchlistItem(ctx.user.id, input.itemId);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Watchlist item not found." });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "watchlist_updated", status: "success", subject: `Watchlist item removed: ${record.label}`, detail: "Owner removed an asset from discovery scope.", payload: { itemId: input.itemId } });
      return record;
    }),
    updateScope: protectedProcedure.input(watchlistScopeSchema).mutation(async ({ ctx, input }) => {
      const record = await updateWatchlistCriteria(ctx.user.id, input.watchlistId, { scope: "owner-defined", chains: input.chains, evidenceStandard: input.evidenceStandard, execution: "simulation-only" });
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Watchlist not found." });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "watchlist_updated", status: "success", subject: `Watchlist scope: ${record.name}`, detail: "Owner changed the bounded discovery scope. No execution authority changed.", payload: { watchlistId: record.watchlistId, criteria: record.criteria } });
      return record;
    }),
    evaluatePolicy: protectedProcedure.mutation(async ({ ctx }) => {
      const [items, policy] = await Promise.all([listWatchlistItems(ctx.user.id), getInvestmentPolicy(ctx.user.id)]);
      const allowedAssets = new Set((policy?.allowedAssets ?? []).map((asset) => asset.toLowerCase()));
      const updated = [];
      for (const item of items) {
        const status = !item.address ? "review" as const : !policy ? "review" as const : allowedAssets.has(item.address.toLowerCase()) ? "candidate" as const : "blocked" as const;
        const record = await updateWatchlistItemStatus(ctx.user.id, item.itemId, status);
        if (record) updated.push(record);
      }
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "watchlist_updated", status: policy ? "success" : "review", subject: "Watchlist IPS evaluation", detail: policy ? "Watchlist contract candidates were evaluated against the active IPS approved universe." : "No active IPS exists; watchlist assets remain under review.", payload: { itemCount: updated.length, policyVersion: policy?.version ?? null, simulationOnly: true } });
      return { updated, policyPresent: Boolean(policy) };
    }),
  }),
  discovery: router({
    schedules: protectedProcedure.query(({ ctx }) => listDiscoverySchedules(ctx.user.id)),
    configureInactive: protectedProcedure.input(z.object({ cadence: z.enum(["daily", "six_hour"]) })).mutation(async ({ ctx, input }) => {
      const record = await createDiscoverySchedule(ctx.user.id, { scheduleId: nanoid(), cadence: input.cadence });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "discovery_schedule_configured", status: "review", subject: `${input.cadence === "daily" ? "Daily deep discovery" : "Six-hour signal scanner"} configured`, detail: "The schedule is saved inactive and cannot run until deployment and explicit owner activation.", payload: { scheduleId: record?.scheduleId, cadence: input.cadence, enabled: false } });
      return record;
    }),
    activate: protectedProcedure.input(z.object({ scheduleId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV !== "production") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Deploy the site before activating scheduled discovery. The development preview cannot receive durable scheduler callbacks." });
      const schedule = await getDiscoverySchedule(ctx.user.id, input.scheduleId);
      if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Discovery schedule not found." });
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const cron = schedule.cadence === "daily" ? "0 0 9 * * *" : "0 0 */6 * * *";
      const job = schedule.scheduleCronTaskUid
        ? await updateHeartbeatJob(schedule.scheduleCronTaskUid, { enable: true, cron, path: "/api/scheduled/discovery", description: `Ledgerline ${schedule.cadence} simulation-only watchlist discovery` }, sessionToken).then(() => ({ taskUid: schedule.scheduleCronTaskUid! }))
        : await createHeartbeatJob({ name: `ledgerline-discovery-${schedule.scheduleId}`, cron, path: "/api/scheduled/discovery", payload: { schemaVersion: 1 }, description: `Ledgerline ${schedule.cadence} simulation-only watchlist discovery` }, sessionToken);
      const active = await activateDiscoverySchedule(ctx.user.id, schedule.scheduleId, job.taskUid);
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "discovery_schedule_configured", status: "success", subject: `${schedule.cadence} discovery activated`, detail: "Owner activated an authenticated, simulation-only watchlist discovery job on the deployed site.", payload: { scheduleId: schedule.scheduleId, taskUid: job.taskUid, cadence: schedule.cadence, execution: "simulation-only" } });
      return active;
    }),
    pause: protectedProcedure.input(z.object({ scheduleId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const schedule = await getDiscoverySchedule(ctx.user.id, input.scheduleId);
      if (!schedule) throw new TRPCError({ code: "NOT_FOUND", message: "Discovery schedule not found." });
      if (schedule.scheduleCronTaskUid) {
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        await updateHeartbeatJob(schedule.scheduleCronTaskUid, { enable: false }, sessionToken);
      }
      const paused = await pauseDiscoverySchedule(ctx.user.id, input.scheduleId);
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "discovery_schedule_configured", status: "review", subject: `${schedule.cadence} discovery paused`, detail: "Owner paused this discovery schedule. No new automated finding will be created until reactivated.", payload: { scheduleId: schedule.scheduleId, enabled: false } });
      return paused;
    }),
  }),
  research: router({
    analyzeToken: protectedProcedure.input(researchRequestSchema).mutation(async ({ ctx, input }) => {
      const savedPolicy = await getInvestmentPolicy(ctx.user.id);
      const policy = savedPolicy ? {
        name: savedPolicy.name,
        version: savedPolicy.version,
        allowedAssets: savedPolicy.allowedAssets,
      } : null;
      const research = await runTokenResearch(input, policy);
      const runId = nanoid();
      const runStatus = research.advancement.status === "allowed" ? "passed" : research.advancement.status;
      const evidence = [
        `token:${research.evidence.asset.address}`,
        `source:${research.evidence.provenance.sources.explorer}`,
        `source:${research.evidence.provenance.sources.market}`,
        `freshness:${research.evidence.provenance.freshness}`,
        "execution-sealed",
      ];
      await createAgentRun(ctx.user.id, {
        runId,
        status: runStatus,
        policyResult: research.policy.result,
        summary: research.report.headline,
        evidence,
      });
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "research_completed",
        status: research.advancement.status === "allowed" ? "success" : research.advancement.status,
        subject: `Research report: ${research.evidence.asset.symbol}`,
        detail: "The owner requested an evidence-bound, simulation-only token research report.",
        payload: { runId, question: input.question, policy: research.policy, advancement: research.advancement, evidence: research.evidence, report: research.report },
      });
      await createAwarenessRecord(ctx.user.id, {
        layer: "justification",
        subject: `Research report: ${research.evidence.asset.symbol}`,
        runId,
        evidence,
        summary: `${research.report.headline} ${research.advancement.reason}`,
      });
      const proposalStatus = research.policy.result === "pass" ? "review" as const : "blocked" as const;
      const proposal = await createAgentProposal(ctx.user.id, {
        proposalId: nanoid(), runId, walletRole: "trading", venue: "evm", status: proposalStatus, policyResult: research.policy.result,
        title: research.report.headline, rationale: research.report.thesis,
        action: { kind: "token_research_paper_proposal", address: research.evidence.asset.address, nextStep: research.report.researchNextStep, execution: "simulation-only" },
      });
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(), kind: "proposal_created", status: proposalStatus === "review" ? "review" : "blocked", subject: `Paper proposal: ${research.evidence.asset.symbol}`,
        detail: proposalStatus === "review" ? "A policy-passing research result entered the owner review queue for simulation only." : "The research result cannot enter the proposal queue because it did not pass the active policy.",
        payload: { proposalId: proposal?.proposalId, runId, policyResult: research.policy.result, venue: "evm", walletRole: "trading" },
      });
      return { runId, proposalId: proposal?.proposalId, ...research };
    }),
  }),
  autonomy: router({
    mandates: protectedProcedure.query(({ ctx }) => listWalletMandates(ctx.user.id)),
    connections: protectedProcedure.query(({ ctx }) => listVenueConnections(ctx.user.id)),
    proposals: protectedProcedure.query(({ ctx }) => listAgentProposals(ctx.user.id)),
    reviewHardGate: protectedProcedure.input(hardGateReviewSchema).mutation(async ({ ctx, input }) => {
      requireOwnerAdmin(ctx.user.role);
      const proposal = await getAgentProposal(ctx.user.id, input.proposalId);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
      const gate = evaluatePromotionGate({ policyResult: proposal.policyResult, simulationPassed: input.simulationPassed, ownerPauseActive: input.ownerPauseActive, lineageCoverage: input.lineageCoverage / 100, complexityPenalty: input.complexityPenalty / 100 });
      const status = gate.state === "pass" ? "success" : gate.state === "review" ? "review" : "blocked";
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(), kind: "scope_checked", status,
        subject: `Hard gate: ${proposal.title}`,
        detail: `${gate.reason} This gate governs paper-simulation review only; no live action can follow.`,
        payload: { gateType: "promotion-review", proposalId: proposal.proposalId, inputs: { simulationPassed: input.simulationPassed, lineageCoverage: input.lineageCoverage, complexityPenalty: input.complexityPenalty, ownerPauseActive: input.ownerPauseActive }, rationale: input.rationale, decision: gate, simulationOnly: true },
        capabilityIds: ["paper-proposal.compose", "portfolio-snapshot.read"],
      });
      return { proposal: { proposalId: proposal.proposalId, title: proposal.title, status: proposal.status }, gate, executionBoundary: "simulation-only" as const };
    }),
    createSimulationMandate: protectedProcedure.input(mandateCreateSchema).mutation(async ({ ctx, input }) => {
      const mandate = await createWalletMandate(ctx.user.id, { mandateId: nanoid(), ...input, mode: "simulation", status: "active" });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "mandate_created", status: "success", subject: `${input.walletRole} wallet · ${input.venue} mandate`, detail: "Owner created a simulation-only mandate. No credential or live venue action was configured.", payload: { mandateId: mandate?.mandateId, ...input, mode: "simulation" } });
      return mandate;
    }),
    setMandateMode: protectedProcedure.input(z.object({ mandateId: z.string().trim().min(1).max(64), mode: z.enum(["simulation", "armed", "real", "paused"]) })).mutation(async ({ ctx, input }) => {
      if (input.mode === "real") throw new TRPCError({ code: "FORBIDDEN", message: "Real mode is not available: no verified live adapter, owner arming ceremony, or execution gateway exists." });
      const mandate = await updateWalletMandateMode(ctx.user.id, input.mandateId, input.mode);
      if (!mandate) throw new TRPCError({ code: "NOT_FOUND", message: "Mandate not found." });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "mandate_mode_changed", status: input.mode === "paused" ? "review" : "success", subject: `${mandate.walletRole} wallet mandate mode`, detail: `Owner changed this mandate to ${input.mode}. Real mode remains unavailable.`, payload: { mandateId: mandate.mandateId, mode: input.mode, venue: mandate.venue } });
      return mandate;
    }),
    createSimulationConnection: protectedProcedure.input(connectionCreateSchema).mutation(async ({ ctx, input }) => {
      const connection = await createVenueConnection(ctx.user.id, { connectionId: nanoid(), ...input, state: "simulation" });
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "venue_configured", status: "success", subject: `${input.venue} simulated adapter`, detail: "Owner enabled a simulated adapter. No external account, credential, or signed action was connected.", payload: { connectionId: connection?.connectionId, ...input, state: "simulation" } });
      return connection;
    }),
    approveProposal: protectedProcedure.input(hardGateReviewSchema).mutation(async ({ ctx, input }) => {
      requireOwnerAdmin(ctx.user.role);
      const proposal = await getAgentProposal(ctx.user.id, input.proposalId);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
      if (proposal.status !== "review" || proposal.policyResult !== "pass") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a policy-passing proposal awaiting review can be approved for simulation." });
      const gate = evaluatePromotionGate({ policyResult: proposal.policyResult, simulationPassed: input.simulationPassed, ownerPauseActive: input.ownerPauseActive, lineageCoverage: input.lineageCoverage / 100, complexityPenalty: input.complexityPenalty / 100 });
      if (gate.state !== "pass") throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Hard evaluation gate did not pass: ${gate.reason}` });
      const updated = await updateAgentProposalStatus(ctx.user.id, input.proposalId, "approved");
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "proposal_approved", status: "success", subject: `Simulation approved: ${proposal.title}`, detail: "Administrator approved this proposal for simulated execution only after a passing hard evaluation gate.", payload: { proposalId: input.proposalId, venue: proposal.venue, walletRole: proposal.walletRole, gate, rationale: input.rationale, simulationOnly: true } });
      return updated;
    }),
    rejectProposal: protectedProcedure.input(z.object({ proposalId: z.string().trim().min(1).max(64), reason: z.string().trim().min(2).max(500) })).mutation(async ({ ctx, input }) => {
      const proposal = await getAgentProposal(ctx.user.id, input.proposalId);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
      if (proposal.status !== "review") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a proposal awaiting review can be rejected." });
      const updated = await updateAgentProposalStatus(ctx.user.id, input.proposalId, "rejected");
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "proposal_rejected", status: "review", subject: `Simulation rejected: ${proposal.title}`, detail: input.reason, payload: { proposalId: input.proposalId, venue: proposal.venue, walletRole: proposal.walletRole } });
      return updated;
    }),
    settleSimulation: protectedProcedure.input(z.object({ proposalId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const proposal = await getAgentProposal(ctx.user.id, input.proposalId);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
      if (proposal.status !== "approved") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only an owner-approved proposal can be settled in the simulator." });
      const updated = await updateAgentProposalStatus(ctx.user.id, input.proposalId, "simulated");
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "simulation_settled", status: "success", subject: `Simulation settled: ${proposal.title}`, detail: "The simulated venue adapter recorded a paper outcome. No external order or transaction occurred.", payload: { proposalId: input.proposalId, venue: proposal.venue, walletRole: proposal.walletRole, simulationOnly: true } });
      await createAwarenessRecord(ctx.user.id, { layer: "result", subject: `Simulation settled: ${proposal.title}`, runId: proposal.runId ?? undefined, evidence: ["simulated-adapter", `venue:${proposal.venue}`, `proposal:${proposal.proposalId}`], summary: "An approved proposal completed the simulated adapter lifecycle without an external action." });
      return updated;
    }),
  }),
  history: router({
    list: protectedProcedure.query(({ ctx }) => listOperatorActions(ctx.user.id)),
    record: protectedProcedure.input(actionSchema).mutation(({ ctx, input }) => createOperatorAction(ctx.user.id, { actionId: nanoid(), ...input })),
    startSimulation: protectedProcedure.input(z.object({ policyVersion: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const runId = nanoid();
      const run = await createAgentRun(ctx.user.id, {
        runId,
        status: "passed",
        policyResult: "pass",
        summary: "Owner initiated a policy-bound paper simulation; execution remains unavailable.",
        evidence: [`ips-version:${input.policyVersion}`, "execution-sealed", "owner-initiated"],
      });
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "simulation_started",
        status: "success",
        subject: `Paper simulation ${runId}`,
        detail: "Owner started a policy-bound paper simulation. No execution adapter is available.",
        payload: { runId, policyVersion: input.policyVersion, simulationOnly: true },
      });
      await createAwarenessRecord(ctx.user.id, {
        layer: "action",
        subject: `Paper simulation ${runId}`,
        runId,
        evidence: [`ips-version:${input.policyVersion}`, "simulation-only", "execution-sealed"],
        summary: "A paper simulation was initiated by the authenticated owner under the active IPS.",
      });
      return run;
    }),
  }),
  audit: router({
    awareness: protectedProcedure.query(({ ctx }) => listAwarenessRecords(ctx.user.id)),
    lineages: protectedProcedure.query(({ ctx }) => listStrategyLineages(ctx.user.id)),
    evaluations: protectedProcedure.query(({ ctx }) => listStrategyEvaluations(ctx.user.id)),
    outcomes: protectedProcedure.query(({ ctx }) => listOutcomeRecords(ctx.user.id)),
    createLineage: protectedProcedure.input(lineageSchema).mutation(async ({ ctx, input }) => {
      const record = await createStrategyLineage(ctx.user.id, { ...input, scores: {} });
      await createAwarenessRecord(ctx.user.id, { layer: "evolutionary", subject: `Lineage ${input.lineageId}`, evidence: ["owner-recorded", `stage:${input.stage}`], summary: input.rationale });
      return record;
    }),
    createEvaluation: protectedProcedure.input(evaluationSchema).mutation(async ({ ctx, input }) => {
      const record = await createStrategyEvaluation(ctx.user.id, input);
      await createAwarenessRecord(ctx.user.id, { layer: "justification", subject: `Evaluation ${input.lineageId}:${input.version}`, evidence: [`gate:${input.gateResult}`, `coverage:${input.coverage}`], summary: input.rationale });
      return record;
    }),
    createOutcome: protectedProcedure.input(outcomeSchema).mutation(async ({ ctx, input }) => {
      const record = await createOutcomeRecord(ctx.user.id, { ...input, attribution: {} });
      await createAwarenessRecord(ctx.user.id, { layer: "result", subject: `Outcome ${input.lineageId}`, runId: input.runId, evidence: [`deviation:${input.deviation}`, `expected-bps:${input.expectedBps}`], summary: input.narrative });
      return record;
    }),
  }),
  onchain: router({
    ethereumToken: publicProcedure.input(z.object({ address: ethereumAddressSchema })).query(({ input }) => getEthereumTokenMetrics(input.address)),
  }),
});

export type AppRouter = typeof appRouter;
