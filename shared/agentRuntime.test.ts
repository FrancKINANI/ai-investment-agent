import { describe, expect, it } from "vitest";
import { decideProposal, evaluatePromotionGate } from "./agentRuntime";

describe("Ledgerline execution boundary", () => {
  it("blocks an execution request even when policy passes", () => {
    const decision = decideProposal({
      policyResult: "pass",
      simulationOnly: true,
      ownerPauseActive: false,
      requestedScope: "execution.request",
    });
    expect(decision.status).toBe("blocked");
  });

  it("blocks any proposal while the owner pause is active", () => {
    const decision = decideProposal({
      policyResult: "pass",
      simulationOnly: true,
      ownerPauseActive: true,
      requestedScope: "proposal.write",
    });
    expect(decision.status).toBe("blocked");
  });

  it("permits only a policy-passing paper proposal", () => {
    const decision = decideProposal({
      policyResult: "pass",
      simulationOnly: true,
      ownerPauseActive: false,
      requestedScope: "proposal.write",
    });
    expect(decision).toMatchObject({ status: "allowed" });
  });

  it("keeps a strategy in review when regime coverage is insufficient", () => {
    expect(evaluatePromotionGate({ policyResult: "pass", simulationPassed: true, ownerPauseActive: false, lineageCoverage: 0.55, complexityPenalty: 0.1 }).state).toBe("review");
  });

  it("never promotes a strategy while an owner pause is active", () => {
    expect(evaluatePromotionGate({ policyResult: "pass", simulationPassed: true, ownerPauseActive: true, lineageCoverage: 0.92, complexityPenalty: 0.1 }).state).toBe("block");
  });
});
