import { describe, expect, it } from "vitest";
import { decideProposal } from "./agentRuntime";

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
});

