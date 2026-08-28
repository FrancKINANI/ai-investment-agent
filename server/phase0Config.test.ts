import { describe, expect, it } from "vitest";
import { getPhase0ConfigurationSummary, loadPhase0Configuration } from "./phase0Config";

describe("Ledgerline safe Phase 0 configuration", () => {
  it("loads the declared fail-closed configuration and disabled MCP declarations", () => {
    const summary = getPhase0ConfigurationSummary();
    expect(summary).toMatchObject({ project: "Ledgerline", executionBoundary: "fail-closed", activeMcpCapabilityCount: 0 });
    expect(summary.featureFlags).toMatchObject({ cexExecution: false, mcpActivation: false, liveExecution: false });
    expect(summary.mcpServers).toEqual(expect.arrayContaining([expect.objectContaining({ id: "sailor", state: "disabled", registration: "declarative-only", transport: "not-configured" })]));
  });

  it("cross-validates static research sources and protected bindings against the active capability registry", () => {
    const configuration = loadPhase0Configuration();
    expect(configuration.sources.sources.every((source) => source.connection === "server-managed-public-data")).toBe(true);
    expect(configuration.bindings.bindings.length).toBeGreaterThanOrEqual(4);
    expect(configuration.mcp.servers.every((server) => !Object.hasOwn(server, "command") && !Object.hasOwn(server, "url"))).toBe(true);
  });
});
