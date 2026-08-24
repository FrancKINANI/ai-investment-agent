import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { decideProposal } from "@shared/agentRuntime";
import { getSessionCookieOptions } from "./_core/cookies";
import { listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAgentRun, createAwarenessRecord, createOperatorAction, createOutcomeRecord, createStrategyEvaluation, createStrategyLineage, getInvestmentPolicy, listAgentProfiles, listAgentRuns, listAwarenessRecords, listOperatorActions, listOutcomeRecords, listStrategyEvaluations, listStrategyLineages, saveInvestmentPolicy } from "./db";
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
      return { runId, ...research };
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
