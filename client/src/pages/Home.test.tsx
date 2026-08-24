import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResearchRecordReview } from "./Home";

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
