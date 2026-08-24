import { describe, expect, it } from "vitest";
import { assessResearchPolicy } from "./research";
import { decideProposal } from "@shared/agentRuntime";

const ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

describe("Phase 1 research policy gates", () => {
  it("allows an approved contract to advance only to paper-simulation review", () => {
    const policy = assessResearchPolicy(ADDRESS, {
      name: "Core on-chain",
      version: 3,
      allowedAssets: [ADDRESS.toLowerCase()],
    });
    const decision = decideProposal({ policyResult: policy.result, simulationOnly: true, ownerPauseActive: false, requestedScope: "proposal.write" });

    expect(policy.result).toBe("pass");
    expect(decision).toEqual({ status: "allowed", reason: "Proposal may proceed to paper simulation only." });
  });

  it("keeps research under review when no IPS exists", () => {
    const policy = assessResearchPolicy(ADDRESS, null);
    const decision = decideProposal({ policyResult: policy.result, simulationOnly: true, ownerPauseActive: false, requestedScope: "proposal.write" });

    expect(policy.result).toBe("review");
    expect(policy.reasons[0]).toContain("No Investment Policy Statement");
    expect(decision.status).toBe("review");
  });

  it("keeps contracts outside the approved universe from advancing", () => {
    const policy = assessResearchPolicy(ADDRESS, {
      name: "Stablecoin yield pilot",
      version: 1,
      allowedAssets: ["0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"],
    });

    expect(policy.result).toBe("review");
    expect(policy.reasons[0]).toContain("outside the IPS approved asset universe");
  });
});
