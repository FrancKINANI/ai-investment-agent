import { describe, expect, it } from "vitest";
import { validateOverlayBinding } from "./configOverlay";

describe("LL-SEC-003: Overlay binding escalation prevention", () => {
  it("allows research-only permission in overlay", () => {
    const result = validateOverlayBinding({
      capabilityId: "market-evidence.read",
      roleKeys: ["macro"],
      permission: "research-only",
    });
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("allows simulation-only permission in overlay", () => {
    const result = validateOverlayBinding({
      capabilityId: "paper-proposal.compose",
      roleKeys: ["variation"],
      permission: "simulation-only",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects execution permission in overlay", () => {
    const result = validateOverlayBinding({
      capabilityId: "cex-trade.execute",
      roleKeys: ["execution"],
      permission: "execution",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("execution");
    expect(result.reason).toContain("staged requestBindingChange workflow");
  });

  it("rejects any unknown permission in overlay", () => {
    const result = validateOverlayBinding({
      capabilityId: "some-cap",
      roleKeys: ["risk"],
      permission: "admin-all",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not allowed");
  });
});
