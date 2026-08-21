import { describe, expect, it } from "vitest";
import { evaluatePolicy, evaluateRule } from "./policy";

describe("policy evaluator", () => {
  it("passes a rule comfortably inside a maximum", () => {
    expect(evaluateRule({ rule: "asset cap", current: 18, limit: 25, direction: "max" }).state).toBe("Within");
  });

  it("flags a rule near a maximum for review", () => {
    expect(evaluateRule({ rule: "asset cap", current: 24, limit: 25, direction: "max" }).state).toBe("Review");
  });

  it("blocks a rule beyond a maximum", () => {
    expect(evaluateRule({ rule: "asset cap", current: 27, limit: 25, direction: "max" }).state).toBe("Blocked");
  });

  it("requires review without blocking when a rule is near its boundary", () => {
    const result = evaluatePolicy([
      { rule: "reserve", current: 31, limit: 30, direction: "min" },
      { rule: "turnover", current: 2, limit: 8, direction: "max" },
    ]);
    expect(result.canProceed).toBe(true);
    expect(result.requiresReview).toBe(true);
  });
});
