import { describe, expect, it } from "vitest";
import { McpServerManager } from "./mcpServer";

describe("MCP sealed boundary", () => {
  it("rejects activation attempts even when a caller supplies an enabled flag", () => {
    const manager = new McpServerManager();
    expect(() => manager.initialize({ mcpActivation: true })).toThrow(/sealed/i);
  });

  it("keeps startAll inert when the manager was initialized in the safe configuration", async () => {
    const manager = new McpServerManager();
    manager.initialize({ mcpActivation: false });
    const statuses = await manager.startAll();
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => status.state === "disabled" && status.tools.length === 0)).toBe(true);
  });
});
