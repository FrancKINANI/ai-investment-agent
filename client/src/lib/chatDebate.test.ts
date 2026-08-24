import { describe, expect, it } from "vitest";
import { getChatPresentation, getResearchNoteConfidenceBand, matchesChatFilter } from "./chatDebate";

describe("chat debate filter", () => {
  const roles = new Map([["bull", "bull"], ["bear", "bear"], ["manager", "fund_manager"]]);

  it("keeps both canonical and legacy Bull/Bear aliases visually distinct", () => {
    expect(getChatPresentation("agent", "bull", roles).tone).toBe("bull");
    expect(getChatPresentation("agent", "bear", roles).tone).toBe("bear");
    expect(getChatPresentation("agent", "legacy", new Map([["legacy", "bull_researcher"]])).label).toBe("BULL CASE · UPSIDE");
  });

  it("filters only the requested research position while retaining Fund Manager review in the supervisor view", () => {
    expect(matchesChatFilter("bull", "agent", "bull", roles)).toBe(true);
    expect(matchesChatFilter("bull", "agent", "bear", roles)).toBe(false);
    expect(matchesChatFilter("bear", "agent", "bear", roles)).toBe(true);
    expect(matchesChatFilter("supervisor", "supervisor", undefined, roles)).toBe(true);
    expect(matchesChatFilter("supervisor", "agent", "manager", roles)).toBe(true);
    expect(matchesChatFilter("supervisor", "owner", undefined, roles)).toBe(false);
  });

  it("uses textual research-note completeness bands alongside deterministic numeric scores", () => {
    expect(getResearchNoteConfidenceBand(35)).toEqual({ label: "Limited coverage", tone: "limited" });
    expect(getResearchNoteConfidenceBand(62)).toEqual({ label: "Developing coverage", tone: "developing" });
    expect(getResearchNoteConfidenceBand(80)).toEqual({ label: "Strong coverage", tone: "strong" });
  });
});
