import { describe, expect, it } from "vitest";
import { capabilityRegistry, getCapabilityRegistrySummary, createCapabilityProvenance, validateCapabilityBindingDraft } from "./capabilityRegistry";

describe("PAIA capability registry", () => {
  it("accepts only safe research and paper-proposal scopes", () => {
    const scopes = capabilityRegistry.capabilities.flatMap((capability) => capability.scopes);
    expect(scopes).not.toContain("execution.request");
    expect(capabilityRegistry.executionBoundary).toBe("fail-closed");
  });

  it("resolves every declared binding to a configured capability", () => {
    const summary = getCapabilityRegistrySummary();
    const capabilityIds = new Set(summary.capabilities.map((capability) => capability.id));
    expect(summary.bindings.every((binding) => capabilityIds.has(binding.capabilityId))).toBe(true);
    expect(summary.mcpCapabilityCount).toBe(0);
  });

  it("accepts only protected-role bindings whose scopes fit the selected capability", () => {
    const accepted = validateCapabilityBindingDraft({ capabilityId: "market-evidence.read", roleKeys: ["fundamental", "bull"], permission: "research-only" });
    const rejected = validateCapabilityBindingDraft({ capabilityId: "paper-proposal.compose", roleKeys: ["fundamental"], permission: "research-only" });
    expect(accepted.valid).toBe(true);
    expect(rejected.valid).toBe(false);
    expect(rejected.issues.join(" ")).toContain("simulation-only");
  });

  it("records capability identifiers and versions without inventing a registry source for owner-only work", () => {
    const capabilitySource = createCapabilityProvenance(["market-evidence.read"]);
    const ownerSource = createCapabilityProvenance();
    expect(capabilitySource).toMatchObject({ origin: "capability-registry", executionBoundary: "fail-closed", capabilities: [{ id: "market-evidence.read", version: "1.0.0" }] });
    expect(ownerSource).toMatchObject({ origin: "owner-control", capabilities: [] });
  });
});
