import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { roleMayUseCapability, validateCapabilityAccess } from "@shared/capabilityRegistry";

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
  it("returns the validated registry to an authenticated owner", async () => {
    const caller = appRouter.createCaller(createOwnerContext());
    const registry = await caller.agentFabric.capabilityRegistry();

    expect(registry.executionBoundary).toBe("fail-closed");
    expect(registry.capabilityCount).toBeGreaterThan(0);
    expect(registry.mcpCapabilityCount).toBe(0);
    expect(registry.capabilities.flatMap((capability) => capability.scopes)).not.toContain("execution.request");
  });

  it("returns the validated safe Phase 0 configuration summary without exposing an MCP activation path", async () => {
    const caller = appRouter.createCaller(createOwnerContext());
    const configuration = await caller.agentFabric.phase0Configuration();
    expect(configuration).toMatchObject({ project: "Ledgerline", executionBoundary: "fail-closed", activeMcpCapabilityCount: 0 });
    expect(configuration.featureFlags).toMatchObject({ cexExecution: false, mcpActivation: false, liveExecution: false });
    expect(configuration.mcpServers.every((server) => server.state === "disabled" && server.registration === "declarative-only")).toBe(true);
  });

  it("rejects non-admin staged binding and hard-gate mutations before any configuration or proposal can change", async () => {
    const caller = appRouter.createCaller(createOwnerContext());
    await expect(caller.agentFabric.validateCapabilityBinding({ capabilityId: "market-evidence.read", roleKeys: ["fundamental"], permission: "research-only" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.autonomy.reviewHardGate({ proposalId: "paper-proposal-1", rationale: "Evidence packet reviewed for the gate." })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not grant an execution binding while the registry is fail-closed", () => {
    expect(roleMayUseCapability("execution", "execution.adapter")).toBe(false);
    expect(() => validateCapabilityAccess("execution", ["execution.adapter"])).toThrow(/not bound/i);
  });
});
