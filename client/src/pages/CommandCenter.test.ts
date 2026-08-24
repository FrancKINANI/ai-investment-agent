import { describe, expect, it } from "vitest";
import { getChatPresentation } from "./CommandCenter";

describe("getChatPresentation", () => {
  const roles = new Map([["bull-1", "bull_researcher"], ["bear-1", "bear_researcher"]]);

  it("gives Bull and Bear researchers distinct, non-color role cues", () => {
    expect(getChatPresentation("agent", "bull-1", roles)).toEqual({ tone: "bull", label: "BULL CASE · UPSIDE", cue: "Positive thesis" });
    expect(getChatPresentation("agent", "bear-1", roles)).toEqual({ tone: "bear", label: "BEAR CASE · RISK", cue: "Challenge thesis" });
  });

  it("retains neutral labels for owner and supervisor messages", () => {
    expect(getChatPresentation("owner", undefined, roles)).toEqual({ tone: "neutral", label: "YOU", cue: undefined });
    expect(getChatPresentation("supervisor", undefined, roles)).toEqual({ tone: "neutral", label: "SUPERVISOR", cue: undefined });
  });
});
