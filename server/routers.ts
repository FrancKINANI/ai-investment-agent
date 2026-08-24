import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { decideProposal } from "@shared/agentRuntime";
import { getSessionCookieOptions } from "./_core/cookies";
import { listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAgentProposal, createAgentRun, createAwarenessRecord, createOperatorAction, createOutcomeRecord, createStrategyEvaluation, createStrategyLineage, createVenueConnection, createWalletMandate, getAgentProposal, getInvestmentPolicy, listAgentProfiles, listAgentProposals, listAgentRuns, listAwarenessRecords, listOperatorActions, listOutcomeRecords, listStrategyEvaluations, listStrategyLineages, listVenueConnections, listWalletMandates, saveInvestmentPolicy, updateAgentProposalStatus, updateWalletMandateMode } from "./db";
import { getEthereumTokenMetrics } from "./onchain";
import { ethereumAddressSchema, investmentPolicySchema, normalizeInvestmentPolicy } from "@shared/ips";
import { researchRequestSchema, runTokenResearch } from "./research";

const proposalSchema = z.object({
  policyResult: z.enum(["pass", "review", "block"]),
  simulationOnly: z.boolean(),
  ownerPauseActive: z.boolean(),
  requestedScope: z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write", "execution.request"]),
});

const actionSchema = z.object({
  kind: z.enum(["policy_updated", "simulation_started", "simulation_blocked", "onchain_viewed", "scope_checked", "outcome_recorded", "promotion_changed", "research_completed"]),
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
    approveProposal: protectedProcedure.input(z.object({ proposalId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const proposal = await getAgentProposal(ctx.user.id, input.proposalId);
      if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
      if (proposal.status !== "review" || proposal.policyResult !== "pass") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a policy-passing proposal awaiting review can be approved for simulation." });
      const updated = await updateAgentProposalStatus(ctx.user.id, input.proposalId, "approved");
      await createOperatorAction(ctx.user.id, { actionId: nanoid(), kind: "proposal_approved", status: "success", subject: `Simulation approved: ${proposal.title}`, detail: "Owner approved this proposal for simulated execution only.", payload: { proposalId: input.proposalId, venue: proposal.venue, walletRole: proposal.walletRole, simulationOnly: true } });
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
