import { describe, expect, it } from "vitest";
import { calculateResearchNoteConfidence, composeFundManagerDisagreementSummary } from "./agentFabric";

describe("agent fabric debate analytics", () => {
  const wellStructuredNote = "Observation: Owner supplied source evidence.\nConstraint: Unknown liquidity.\nNext research check: Verify the source data.";

  it("calculates a bounded, deterministic research-note completeness score rather than a market forecast", () => {
    const score = calculateResearchNoteConfidence(wellStructuredNote);
    expect(score).toBeGreaterThanOrEqual(35);
    expect(score).toBeLessThanOrEqual(88);
    expect(calculateResearchNoteConfidence(wellStructuredNote)).toBe(score);
  });

  it("records a Fund Manager disagreement review without granting execution approval", () => {
    const summary = composeFundManagerDisagreementSummary([
      { role: "bull", name: "Bull researcher", output: wellStructuredNote, confidence: 76 },
      { role: "bear", name: "Bear researcher", output: wellStructuredNote, confidence: 70 },
    ]);
    expect(summary).toContain("Bull case:** 76/100");
    expect(summary).toContain("Bear case:** 70/100");
    expect(summary).toContain("not an execution approval");
  });

  it("keeps authority in research when the debate is incomplete", () => {
    expect(composeFundManagerDisagreementSummary([{ role: "bull", name: "Bull researcher", output: wellStructuredNote, confidence: 76 }])).toContain("Debate incomplete");
  });
});
