import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResearchBrief, ResearchRecordReview } from "./Home";

const createdAt = new Date("2026-08-24T10:00:00.000Z");

describe("ResearchRecordReview", () => {
  it("protects private review data when unauthenticated", () => {
    const markup = renderToStaticMarkup(<ResearchRecordReview isAuthenticated={false} lineages={[]} evaluations={[]} outcomes={[]} />);
    expect(markup).toContain("Authenticate to review private research records.");
  });

  it("renders explicit empty states for an authenticated owner", () => {
    const markup = renderToStaticMarkup(<ResearchRecordReview isAuthenticated lineages={[]} evaluations={[]} outcomes={[]} />);
    expect(markup).toContain("No persisted lineage records yet.");
    expect(markup).toContain("No persisted evaluation records yet.");
    expect(markup).toContain("No persisted outcome records yet.");
  });

  it("renders the key persisted fields for all three record families", () => {
    const markup = renderToStaticMarkup(<ResearchRecordReview isAuthenticated lineages={[{ id: 1, lineageId: "L-1", name: "Liquidity thesis", stage: "research", generation: 2, createdAt }]} evaluations={[{ id: 2, lineageId: "L-1", version: "v2", gateResult: "review", coverage: 85, complexityPenalty: 12, createdAt }]} outcomes={[{ id: 3, lineageId: "L-1", expectedBps: 120, realizedBps: 80, deviation: "underperforming", createdAt }]} />);
    expect(markup).toContain("Liquidity thesis");
    expect(markup).toContain("Coverage 85%");
    expect(markup).toContain("Expected 120 bps");
    expect(markup).toContain("underperforming");
  });
});

describe("ResearchBrief", () => {
  const baseResult = {
    runId: "run-1",
    report: {
      headline: "Evidence supports a cautious review",
      marketObservation: "The available market record is incomplete and should not be generalized.",
      thesis: "The packet supports only limited observations and requires more diligence before any paper decision.",
      risks: ["Liquidity can change rapidly.", "The available evidence excludes protocol-specific diligence."],
      catalysts: ["Verify source availability over time."],
      unknowns: ["No protocol fundamentals are included in the current packet."],
      researchNextStep: "Review the token contract and source history before considering a paper test.",
    },
    evidence: {
      asset: { address: "0x0000000000000000000000000000000000000001", name: "Example Token", symbol: "EXM", holders: 10, explorerPriceUsd: 1, marketCap: 100 },
      market: { priceUsd: 1, liquidityUsd: 100, volume24h: 50, priceChange24h: 2, dex: "uniswap", pairAddress: "0x0000000000000000000000000000000000000002" },
      provenance: { sources: { explorer: "Blockscout public API", market: "DexScreener public API" }, fetchedAt: 0, freshness: "live", authority: "public read-only" },
    },
    policy: { result: "review" as const, reasons: ["The contract is outside the approved universe."] },
    advancement: { status: "review" as const, reason: "Owner evidence review is required." },
  };

  it("renders a review state without a paper-simulation action", () => {
    const html = renderToStaticMarkup(<ResearchBrief result={baseResult} onStartSimulation={() => undefined} />);

    expect(html).toContain("Owner review required");
    expect(html).toContain("Research cannot advance yet");
    expect(html).toContain("The contract is outside the approved universe.");
    expect(html).not.toContain("Start paper simulation");
  });
});
