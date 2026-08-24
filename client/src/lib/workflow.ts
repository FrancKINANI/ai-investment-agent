/** UI workflow transitions for v0.2; execution is intentionally not a reachable state. */
export type PromotionStage = "research" | "simulation" | "decision" | "retired";

export function nextPromotionStage(stage: PromotionStage, gate: "pass" | "review" | "block") {
  if (stage === "research") return { next: "simulation" as const, action: "simulation" as const };
  if (stage === "simulation" && gate === "pass") return { next: "decision" as const, action: "decision" as const };
  if (stage === "simulation") return { next: "simulation" as const, action: "hold" as const };
  return { next: stage, action: "hold" as const };
}

export function outcomeStatus(expectedBps: number, realizedBps: number | null) {
  if (realizedBps === null) return "inconclusive" as const;
  if (realizedBps < expectedBps - 50) return "underperforming" as const;
  if (realizedBps > expectedBps + 50) return "outperforming" as const;
  return "on_track" as const;
}
