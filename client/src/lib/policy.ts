/* Ledgerline policy boundary — deterministic, explainable, and independent from any future reasoning layer. */
export type PolicyState = "Within" | "Review" | "Blocked";

export type PolicyRule = {
  rule: string;
  current: number;
  limit: number;
  direction: "max" | "min";
};

export type EvaluatedRule = PolicyRule & { state: PolicyState };

export function evaluateRule(rule: PolicyRule): EvaluatedRule {
  const within = rule.direction === "max" ? rule.current <= rule.limit : rule.current >= rule.limit;
  const distance = Math.abs(rule.current - rule.limit);
  const nearBoundary = rule.direction === "max" ? distance <= rule.limit * 0.1 : distance <= rule.limit * 0.1;
  const state: PolicyState = within ? (nearBoundary ? "Review" : "Within") : "Blocked";
  return { ...rule, state };
}

export function evaluatePolicy(rules: PolicyRule[]) {
  const evaluated = rules.map(evaluateRule);
  return {
    rules: evaluated,
    canProceed: evaluated.every((rule) => rule.state !== "Blocked"),
    requiresReview: evaluated.some((rule) => rule.state === "Review"),
  };
}
