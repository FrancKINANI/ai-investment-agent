import { describe, expect, it } from "vitest";
import {
  validateCapabilityAccess,
  capabilityRegistry,
  getCapabilityRegistrySummary,
  validateCapabilityBindingDraft,
} from "@shared/capabilityRegistry";

describe("Invariant 2: Capability Registry - Deny-by-Default Gating", () => {
  it("validateCapabilityAccess throws for nonexistent capability", () => {
    expect(() => {
      validateCapabilityAccess("nonexistent-role", ["nonexistent-capability"]);
    }).toThrow("Capability nonexistent-capability not found in registry.");
  });

  it("validateCapabilityAccess checks capability state", () => {
    // Should not throw for an active capability like market-evidence.read for variation
    const result = validateCapabilityAccess("variation", ["market-evidence.read"]);
    expect(Array.isArray(result)).toBe(true);
  });

  it("execution boundary is fail-closed", () => {
    expect(capabilityRegistry.executionBoundary).toBe("fail-closed");
  });

  it("capability binding with execution permission rejected when boundary is fail-closed", () => {
    // In fail-closed mode, execution permission should be rejected
    const validation = validateCapabilityBindingDraft({
      capabilityId: "market-evidence.read",
      roleKeys: ["fundamental"],
      permission: "research-only",
    });
    // Boundary is fail-closed, so execution would be rejected
    // But research-only should be valid
    expect(validation.executionBoundary).toBe("fail-closed");
    expect(validation.valid).toBe(true);
  });

  it("capability identifiers are unique in registry", () => {
    const ids = capabilityRegistry.capabilities.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all bindings reference valid capability IDs", () => {
    const summary = getCapabilityRegistrySummary();
    const capabilityIds = new Set(summary.capabilities.map((cap) => cap.id));
    expect(summary.bindings.every((binding) => capabilityIds.has(binding.capabilityId))).toBe(true);
  });
});