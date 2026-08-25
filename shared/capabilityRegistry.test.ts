import { describe, expect, it } from "vitest";
import { capabilityRegistry, getCapabilityRegistrySummary } from "./capabilityRegistry";

describe("PAIA capability registry", () => {
  it("accepts only safe research and paper-proposal scopes", () => {
    const scopes = capabilityRegistry.capabilities.flatMap((capability) => capability.scopes);
    expect(scopes).not.toContain("execution.request");
    expect(capabilityRegistry.executionBoundary).toBe("simulation-only");
  });

  it("resolves every declared binding to a configured capability", () => {
    const summary = getCapabilityRegistrySummary();
    const capabilityIds = new Set(summary.capabilities.map((capability) => capability.id));
    expect(summary.bindings.every((binding) => capabilityIds.has(binding.capabilityId))).toBe(true);
    expect(summary.mcpCapabilityCount).toBe(0);
  });
});
