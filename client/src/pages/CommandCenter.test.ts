import { describe, expect, it } from "vitest";
import { getChatPresentation } from "./CommandCenter";

describe("getChatPresentation", () => {
  const roles = new Map([["bull-1", "bull"], ["bear-1", "bear"]]);

  it("gives Bull and Bear researchers distinct, non-color role cues", () => {
    expect(getChatPresentation("agent", "bull-1", roles)).toEqual({ tone: "bull", label: "BULL CASE · UPSIDE", cue: "Positive thesis", roleKey: "bull" });
    expect(getChatPresentation("agent", "bear-1", roles)).toEqual({ tone: "bear", label: "BEAR CASE · RISK", cue: "Challenge thesis", roleKey: "bear" });
  });

  it("retains neutral labels for owner and supervisor messages", () => {
    expect(getChatPresentation("owner", undefined, roles)).toEqual({ tone: "neutral", label: "YOU", cue: undefined, roleKey: undefined });
    expect(getChatPresentation("supervisor", undefined, roles)).toEqual({ tone: "neutral", label: "SUPERVISOR", cue: undefined, roleKey: undefined });
  });
});
