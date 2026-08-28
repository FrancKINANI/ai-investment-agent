import { describe, expect, it } from "vitest";
import {
  calculateLineageHealth,
  suggestChildLineage,
  shouldPromote,
  formatLineageSummary,
} from "./strategyLineage";
import type { StrategyLineageInput, LineageHealth } from "./strategyLineage";

describe("Strategy Lineage", () => {
  const baseLineage: StrategyLineageInput = {
    lineageId: "eth-momentum",
    name: "ETH Momentum Strategy",
    stage: "research",
    generation: 1,
    rationale: "Momentum-based ETH entry strategy.",
  };

  describe("calculateLineageHealth", () => {
    it("returns continue with no data", () => {
      const health = calculateLineageHealth([], []);
      expect(health.recommendation).toBe("continue");
      expect(health.reason).toContain("No data yet");
    });

    it("recommends retire on low pass rate", () => {
      const evaluations = [
        { gateResult: "block", coverage: 30, complexityPenalty: 20 },
        { gateResult: "block", coverage: 20, complexityPenalty: 30 },
        { gateResult: "review", coverage: 40, complexityPenalty: 10 },
      ];
      const health = calculateLineageHealth(evaluations, []);
      expect(health.recommendation).toBe("retire");
      expect(health.passRate).toBeCloseTo(0);
    });

    it("recommends evolve on consistent underperformance", () => {
      const outcomes = [
        { deviation: "underperforming", expectedBps: 100, realizedBps: -50 },
        { deviation: "underperforming", expectedBps: 100, realizedBps: -30 },
        { deviation: "underperforming", expectedBps: 100, realizedBps: -80 },
      ];
      const health = calculateLineageHealth([], outcomes);
      expect(health.recommendation).toBe("evolve");
      expect(health.avgDeviation).toBeLessThan(-0.5);
    });

    it("recommends continue on strong results", () => {
      const evaluations = [
        { gateResult: "pass", coverage: 80, complexityPenalty: 10 },
        { gateResult: "pass", coverage: 85, complexityPenalty: 5 },
        { gateResult: "pass", coverage: 75, complexityPenalty: 15 },
      ];
      const outcomes = [
        { deviation: "on_track", expectedBps: 100, realizedBps: 95 },
        { deviation: "outperforming", expectedBps: 100, realizedBps: 150 },
      ];
      const health = calculateLineageHealth(evaluations, outcomes);
      expect(health.recommendation).toBe("continue");
      expect(health.passRate).toBe(1);
    });
  });

  describe("suggestChildLineage", () => {
    it("creates a child with incremented generation", () => {
      const health = { passRate: 0.2, avgDeviation: -0.8, reason: "Underperforming" };
      const child = suggestChildLineage(baseLineage, health);
      expect(child.generation).toBe(2);
      expect(child.parentVersion).toBe("eth-momentum");
      expect(child.stage).toBe("research");
      expect(child.lineageId).toContain("gen2");
    });
  });

  describe("shouldPromote", () => {
    it("promotes research to simulation on decent pass rate", () => {
      const health = { passRate: 0.6, avgDeviation: 0, recommendation: "continue" };
      const result = shouldPromote("research", health);
      expect(result.promote).toBe(true);
      expect(result.nextStage).toBe("simulation");
    });

    it("promotes simulation to decision on strong results", () => {
      const health = { passRate: 0.8, avgDeviation: 0.1, recommendation: "continue" };
      const result = shouldPromote("simulation", health);
      expect(result.promote).toBe(true);
      expect(result.nextStage).toBe("decision");
    });

    it("retires on retire recommendation", () => {
      const health = { passRate: 0.1, avgDeviation: -0.9, recommendation: "retire" };
      const result = shouldPromote("research", health);
      expect(result.promote).toBe(true);
      expect(result.nextStage).toBe("retired");
    });

    it("does not promote on evolve recommendation", () => {
      const health = { passRate: 0.4, avgDeviation: -0.6, recommendation: "evolve" };
      const result = shouldPromote("research", health);
      expect(result.promote).toBe(false);
    });
  });

  describe("formatLineageSummary", () => {
    it("formats a readable summary", () => {
      const health: LineageHealth = {
        lineageId: "eth-momentum",
        name: "ETH Momentum",
        stage: "simulation",
        generation: 2,
        totalEvaluations: 5,
        passRate: 0.8,
        totalOutcomes: 3,
        avgDeviation: 0.2,
        recommendation: "continue",
        reason: "Strong results.",
      };
      const summary = formatLineageSummary(health);
      expect(summary).toContain("ETH Momentum");
      expect(summary).toContain("gen 2");
      expect(summary).toContain("80%");
      expect(summary).toContain("continue");
    });
  });
});
