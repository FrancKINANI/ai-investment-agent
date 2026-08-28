import type { AuthorityState } from "./authorityState";
import { evaluatePromotionGate } from "./agentRuntime";

export function ownerPauseFromAuthority(state: AuthorityState): boolean {
  return state === "paused" || state === "revoked";
}

export function deriveHardGateFromRecords(input: {
  authorityState: AuthorityState;
  evaluations: Array<{ simulationPassed: boolean; coverage: number; complexityPenalty: number }>;
  paperOrders: Array<{ status: string }>;
}) {
  const ownerPauseActive = ownerPauseFromAuthority(input.authorityState);
  const latest = input.evaluations[0];
  const filledPaper = input.paperOrders.some((order) => order.status === "filled" || order.status === "reconciled");
  const simulationPassed = filledPaper || latest?.simulationPassed === true;
  const lineageCoverage = latest?.coverage ?? 0;
  const complexityPenalty = latest?.complexityPenalty ?? 100;
  return { ownerPauseActive, simulationPassed, lineageCoverage, complexityPenalty };
}

export function evaluateStoredPromotionGate(input: {
  policyResult: "pass" | "review" | "block";
  authorityState: AuthorityState;
  evaluations: Array<{ simulationPassed: boolean; coverage: number; complexityPenalty: number }>;
  paperOrders: Array<{ status: string }>;
}) {
  const derived = deriveHardGateFromRecords(input);
  return {
    derived,
    gate: evaluatePromotionGate({
      policyResult: input.policyResult,
      simulationPassed: derived.simulationPassed,
      ownerPauseActive: derived.ownerPauseActive,
      lineageCoverage: derived.lineageCoverage / 100,
      complexityPenalty: derived.complexityPenalty / 100,
    }),
  };
}
