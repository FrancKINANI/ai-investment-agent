import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { decideProposal } from "@shared/agentRuntime";
import { getSessionCookieOptions } from "./_core/cookies";
import { listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createAgentRun, createOperatorAction, getInvestmentPolicy, listAgentProfiles, listAgentRuns, listOperatorActions, saveInvestmentPolicy } from "./db";
import { getEthereumTokenMetrics } from "./onchain";
import { ethereumAddressSchema, investmentPolicySchema, normalizeInvestmentPolicy } from "@shared/ips";

const proposalSchema = z.object({
  policyResult: z.enum(["pass", "review", "block"]),
  simulationOnly: z.boolean(),
  ownerPauseActive: z.boolean(),
  requestedScope: z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write", "execution.request"]),
});

const actionSchema = z.object({
  kind: z.enum(["policy_updated", "simulation_started", "simulation_blocked", "onchain_viewed", "scope_checked", "outcome_recorded", "promotion_changed"]),
  status: z.enum(["success", "review", "blocked"]),
  subject: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(2000),
  payload: z.record(z.string(), z.unknown()).default({}),
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
      return run;
    }),
  }),
  onchain: router({
    ethereumToken: publicProcedure.input(z.object({ address: ethereumAddressSchema })).query(({ input }) => getEthereumTokenMetrics(input.address)),
  }),
});

export type AppRouter = typeof appRouter;
