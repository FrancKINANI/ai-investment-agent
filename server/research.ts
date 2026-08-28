import { z } from "zod";
import { decideProposal, type PolicyResult } from "@shared/agentRuntime";
import { isBlockedByDominantState } from "@shared/authorityState";
import { invokeLLM } from "./_core/llm";
import { getEthereumTokenMetrics } from "./onchain";
import { getAuthorityState } from "./db";

export const researchRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid Ethereum token contract address."),
  question: z.string().trim().min(8).max(600),
});

const reportSchema = z.object({
  headline: z.string().trim().min(12).max(220),
  marketObservation: z.string().trim().min(20).max(900),
  thesis: z.string().trim().min(30).max(1_600),
  risks: z.array(z.string().trim().min(8).max(300)).min(2).max(5),
  catalysts: z.array(z.string().trim().min(8).max(300)).min(1).max(4),
  unknowns: z.array(z.string().trim().min(8).max(300)).min(1).max(4),
  researchNextStep: z.string().trim().min(10).max(320),
});

export type ResearchPolicy = {
  name: string;
  version: number;
  allowedAssets: string[];
} | null;

export function assessResearchPolicy(address: string, policy: ResearchPolicy): { result: PolicyResult; reasons: string[] } {
  if (!policy) {
    return {
      result: "review",
      reasons: ["No Investment Policy Statement is saved. Research can be reviewed, but no paper proposal may advance."],
    };
  }

  const approved = policy.allowedAssets.some((asset) => asset.toLowerCase() === address.toLowerCase());
  if (!approved) {
    return {
      result: "review",
      reasons: ["This contract is outside the IPS approved asset universe. It may be researched, but it cannot advance to paper simulation until the owner updates the IPS."],
    };
  }

  return {
    result: "pass",
    reasons: [`The contract is in IPS ${policy.name} v${policy.version}. Any next step remains limited to paper simulation.`],
  };
}

function compactEvidence(metrics: Awaited<ReturnType<typeof getEthereumTokenMetrics>>) {
  const market = metrics.market;
  return {
    asset: {
      address: metrics.token.address,
      name: metrics.token.name,
      symbol: metrics.token.symbol,
      holders: metrics.token.holders,
      explorerPriceUsd: metrics.token.explorerPriceUsd,
      marketCap: metrics.token.marketCap,
    },
    market: market ? {
      priceUsd: market.priceUsd,
      liquidityUsd: market.liquidityUsd,
      volume24h: market.volume24h,
      priceChange24h: market.priceChange24h,
      dex: market.dex,
      pairAddress: market.pairAddress,
    } : null,
    provenance: {
      sources: metrics.sources,
      fetchedAt: metrics.fetchedAt,
      freshness: metrics.freshness,
      authority: metrics.authority,
    },
  };
}

export async function runTokenResearch(
  input: z.infer<typeof researchRequestSchema>,
  policyContext: ResearchPolicy,
  userId: number,
  options?: { model?: string }
) {
  const metrics = await getEthereumTokenMetrics(input.address);
  const evidence = compactEvidence(metrics);
  const policyAssessment = assessResearchPolicy(metrics.token.address, policyContext);

  // S1: Wire authority state check for owner pause
  const authorityState = await getAuthorityState(userId);
  const ownerPauseActive = isBlockedByDominantState(authorityState);

  const completion = await invokeLLM({
    model: options?.model ?? "gpt-5-mini",
    maxTokens: 1_800,
    messages: [
      {
        role: "system",
        content: "You are Ledgerline's crypto/on-chain research analyst. Produce disciplined research, not personalized financial advice. Use only the provided evidence packet. Do not fabricate figures, token facts, news, protocol claims, holders, liquidity, or sources. Do not issue buy, sell, trade, allocation, or price-target instructions. Clearly identify uncertainty and evidence limitations. The system has no wallet, signing, exchange, or execution authority. Return only JSON matching the requested schema.",
      },
      {
        role: "user",
        content: `Owner question: ${input.question}\n\nEvidence packet (all available live data):\n${JSON.stringify(evidence)}\n\nExplain what the evidence can and cannot support.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ledgerline_token_research",
        strict: true,
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            marketObservation: { type: "string" },
            thesis: { type: "string" },
            risks: { type: "array", items: { type: "string" } },
            catalysts: { type: "array", items: { type: "string" } },
            unknowns: { type: "array", items: { type: "string" } },
            researchNextStep: { type: "string" },
          },
          required: ["headline", "marketObservation", "thesis", "risks", "catalysts", "unknowns", "researchNextStep"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("The research model did not return a readable report.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The research model did not return a valid structured report.");
  }
  const report = reportSchema.safeParse(parsed);
  if (!report.success) throw new Error("The research model returned an incomplete report. Please retry.");

  const advancement = decideProposal({
    policyResult: policyAssessment.result,
    simulationOnly: true,
    ownerPauseActive,
    requestedScope: "proposal.write",
  });

  return {
    report: report.data,
    evidence,
    policy: policyAssessment,
    advancement,
  };
}
