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
});
