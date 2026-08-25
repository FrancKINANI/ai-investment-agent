import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createOwnerContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "registry-owner",
      email: "owner@example.com",
      name: "Registry Owner",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("agentFabric.capabilityRegistry", () => {
  it("returns the validated, simulation-only registry to an authenticated owner", async () => {
    const caller = appRouter.createCaller(createOwnerContext());
    const registry = await caller.agentFabric.capabilityRegistry();

    expect(registry.executionBoundary).toBe("simulation-only");
    expect(registry.capabilityCount).toBeGreaterThan(0);
    expect(registry.mcpCapabilityCount).toBe(0);
    expect(registry.capabilities.flatMap((capability) => capability.scopes)).not.toContain("execution.request");
  });

  it("rejects non-admin staged binding and hard-gate mutations before any configuration or proposal can change", async () => {
    const caller = appRouter.createCaller(createOwnerContext());
    await expect(caller.agentFabric.validateCapabilityBinding({ capabilityId: "market-evidence.read", roleKeys: ["fundamental"], permission: "research-only" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.autonomy.reviewHardGate({ proposalId: "paper-proposal-1", simulationPassed: true, lineageCoverage: 80, complexityPenalty: 10, ownerPauseActive: false, rationale: "Evidence packet reviewed for the paper-only gate." })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
