/**
 * Ledgerline Strategy Lineage Service
 *
 * Tracks strategy families through their lifecycle:
 *   research → simulation → decision → retired
 *
 * Each strategy has:
 * - A lineage (family of related versions)
 * - Versions (individual iterations)
 * - Evaluations (hard gate results)
 * - Outcomes (realized vs expected performance)
 *
 * The evolution loop:
 * 1. A proposal is created and linked to a lineage
 * 2. The proposal is evaluated (hard gate)
 * 3. An outcome is recorded (expected vs realized)
 * 4. If outcomes consistently underperform, a child lineage is suggested
 * 5. The evaluator agent reviews and approves/retires lineages
 */

import { z } from "zod";

// ─── Types ─────────────────────────────────────────────────────────────────

export type LineageStage = "research" | "simulation" | "decision" | "retired";

export type StrategyLineageInput = {
  lineageId: string;
  name: string;
  stage: LineageStage;
  generation: number;
  parentVersion?: string;
  rationale: string;
};

export type StrategyEvaluationInput = {
  lineageId: string;
  version: string;
  gateResult: "pass" | "review" | "block";
  simulationPassed: boolean;
  coverage: number; // 0-100
  complexityPenalty: number; // 0-100
  rationale: string;
};

export type OutcomeInput = {
  lineageId: string;
  runId?: string;
  expectedBps: number;
  realizedBps?: number;
  deviation: "on_track" | "underperforming" | "outperforming" | "inconclusive";
  narrative: string;
};

export type LineageHealth = {
  lineageId: string;
  name: string;
  stage: LineageStage;
  generation: number;
  totalEvaluations: number;
  passRate: number; // 0-1
  totalOutcomes: number;
  avgDeviation: number; // -1 to 1 (negative = underperforming)
  recommendation: "continue" | "evolve" | "retire";
  reason: string;
};

// ─── Scoring ───────────────────────────────────────────────────────────────

/**
 * Calculate lineage health from evaluations and outcomes.
 * Used by the evaluator agent to decide whether to advance, evolve, or retire a lineage.
 */
export function calculateLineageHealth(
  evaluations: Array<{ gateResult: string; coverage: number; complexityPenalty: number }>,
  outcomes: Array<{ deviation: string; expectedBps: number; realizedBps?: number }>,
): { passRate: number; avgDeviation: number; recommendation: "continue" | "evolve" | "retire"; reason: string } {
  // Evaluation pass rate
  const passRate = evaluations.length > 0
    ? evaluations.filter((e) => e.gateResult === "pass").length / evaluations.length
    : 0;

  // Average deviation (normalized -1 to 1)
  const deviationMap: Record<string, number> = {
    outperforming: 1,
    on_track: 0,
    underperforming: -1,
    inconclusive: 0,
  };
  const avgDeviation = outcomes.length > 0
    ? outcomes.reduce((sum, o) => sum + (deviationMap[o.deviation] ?? 0), 0) / outcomes.length
    : 0;

  // Recommendation logic
  if (evaluations.length === 0 && outcomes.length === 0) {
    return { passRate, avgDeviation, recommendation: "continue", reason: "No data yet — continue research." };
  }

  if (passRate < 0.3 && evaluations.length >= 2) {
    return { passRate, avgDeviation, recommendation: "retire", reason: `Low pass rate (${Math.round(passRate * 100)}%) across ${evaluations.length} evaluations. Consider retiring this lineage.` };
  }

  if (avgDeviation < -0.5 && outcomes.length >= 2) {
    return { passRate, avgDeviation, recommendation: "evolve", reason: `Consistent underperformance (avg deviation: ${avgDeviation.toFixed(2)}). Consider creating a child lineage with adjusted parameters.` };
  }

  if (passRate >= 0.7 && avgDeviation >= 0) {
    return { passRate, avgDeviation, recommendation: "continue", reason: `Strong pass rate (${Math.round(passRate * 100)}%) and on-track performance. Continue this lineage.` };
  }

  return { passRate, avgDeviation, recommendation: "continue", reason: `Mixed results (pass: ${Math.round(passRate * 100)}%, deviation: ${avgDeviation.toFixed(2)}). Monitor closely.` };
}

/**
 * Suggest a child lineage when a parent is underperforming.
 * Returns the input needed to create a new lineage record.
 */
export function suggestChildLineage(
  parent: StrategyLineageInput,
  health: { passRate: number; avgDeviation: number; reason: string },
): StrategyLineageInput {
  const childGeneration = parent.generation + 1;
  const childName = `${parent.name} v${childGeneration}`;

  return {
    lineageId: `${parent.lineageId}-gen${childGeneration}`,
    name: childName,
    stage: "research",
    generation: childGeneration,
    parentVersion: parent.lineageId,
    rationale: `Evolution from ${parent.name}: ${health.reason}`,
  };
}

/**
 * Evaluate whether a lineage should be promoted to the next stage.
 */
export function shouldPromote(
  currentStage: LineageStage,
  health: { passRate: number; avgDeviation: number; recommendation: string },
): { promote: boolean; nextStage?: LineageStage; reason: string } {
  if (health.recommendation === "retire") {
    return { promote: true, nextStage: "retired", reason: health.reason };
  }

  if (health.recommendation === "evolve") {
    return { promote: false, reason: health.reason };
  }

  // Promotion path: research → simulation → decision
  if (currentStage === "research" && health.passRate >= 0.5) {
    return { promote: true, nextStage: "simulation", reason: "Sufficient research pass rate to advance to simulation." };
  }

  if (currentStage === "simulation" && health.passRate >= 0.7 && health.avgDeviation >= -0.2) {
    return { promote: true, nextStage: "decision", reason: "Strong simulation results. Ready for decision stage." };
  }

  return { promote: false, reason: "Not enough evidence to promote. Continue current stage." };
}

// ─── Lineage Summary ───────────────────────────────────────────────────────

/**
 * Generate a human-readable summary of a lineage's health.
 * Used by the evaluator agent in reports.
 */
export function formatLineageSummary(health: LineageHealth): string {
  const passPct = Math.round(health.passRate * 100);
  const devStr = health.avgDeviation > 0 ? `+${health.avgDeviation.toFixed(2)}` : health.avgDeviation.toFixed(2);

  return [
    `## ${health.name} (gen ${health.generation})`,
    `Stage: ${health.stage}`,
    `Evaluations: ${health.totalEvaluations} (pass rate: ${passPct}%)`,
    `Outcomes: ${health.totalOutcomes} (avg deviation: ${devStr})`,
    `Recommendation: **${health.recommendation}**`,
    `> ${health.reason}`,
  ].join("\n");
}
