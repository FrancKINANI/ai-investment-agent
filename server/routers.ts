import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { decideProposal } from "@shared/agentRuntime";
import { getSessionCookieOptions } from "./_core/cookies";
import { listLLMModels } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { listAgentProfiles, listAgentRuns } from "./db";

const proposalSchema = z.object({
  policyResult: z.enum(["pass", "review", "block"]),
  simulationOnly: z.boolean(),
  ownerPauseActive: z.boolean(),
  requestedScope: z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write", "execution.request"]),
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
});

export type AppRouter = typeof appRouter;
