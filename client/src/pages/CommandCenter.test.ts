import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getChatPresentation } from "./CommandCenter";

const commandSource = readFileSync(fileURLToPath(new URL("./CommandCenter.tsx", import.meta.url)), "utf8");

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

  it("includes a hover-and-focus IPS context explanation next to watchlist evaluation outcomes", () => {
    expect(commandSource).toContain("HoverCard");
    expect(commandSource).toContain("Explain IPS evaluation outcomes");
    expect(commandSource).toContain("Evaluation remains informational and paper-only");
  });
});
