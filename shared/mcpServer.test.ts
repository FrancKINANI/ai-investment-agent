import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { McpServerManager, getMcpServerManager, resetMcpServerManager, mcpConfigFileSchema } from "./mcpServer";

describe("MCP server configuration", () => {
  it("accepts a valid disabled MCP server config", () => {
    const config = mcpConfigFileSchema.parse({
      schemaVersion: 1,
      servers: [
        {
          id: "sailor",
          label: "Sailor",
          type: "mcp_server",
          state: "disabled",
          registration: "declarative-only",
          transport: "not-configured",
          tags: ["onchain"],
        },
      ],
    });
    expect(config.servers).toHaveLength(1);
    expect(config.servers[0].state).toBe("disabled");
  });

  it("accepts an active stdio MCP server with command", () => {
    const config = mcpConfigFileSchema.parse({
      schemaVersion: 1,
      servers: [
        {
          id: "test-server",
          label: "Test Server",
          type: "mcp_server",
          state: "active",
          registration: "dynamic",
          transport: "stdio",
          tags: ["test"],
          command: "node",
          args: ["server.js"],
        },
      ],
    });
    expect(config.servers[0].state).toBe("active");
    expect(config.servers[0].command).toBe("node");
  });

  it("accepts an active SSE MCP server with url", () => {
    const config = mcpConfigFileSchema.parse({
      schemaVersion: 1,
      servers: [
        {
          id: "remote-server",
          label: "Remote Server",
          type: "mcp_server",
          state: "active",
          registration: "dynamic",
          transport: "sse",
          tags: ["remote"],
          url: "https://example.com/mcp",
        },
      ],
    });
    expect(config.servers[0].state).toBe("active");
    expect(config.servers[0].url).toBe("https://example.com/mcp");
  });

  it("rejects active stdio server without command", () => {
    expect(() =>
      mcpConfigFileSchema.parse({
        schemaVersion: 1,
        servers: [
          {
            id: "bad-server",
            label: "Bad Server",
            type: "mcp_server",
            state: "active",
            registration: "dynamic",
            transport: "stdio",
            tags: ["test"],
            // missing command
          },
        ],
      })
    ).toThrow();
  });

  it("rejects active SSE server without url", () => {
    expect(() =>
      mcpConfigFileSchema.parse({
        schemaVersion: 1,
        servers: [
          {
            id: "bad-server",
            label: "Bad Server",
            type: "mcp_server",
            state: "active",
            registration: "dynamic",
            transport: "sse",
            tags: ["test"],
            // missing url
          },
        ],
      })
    ).toThrow();
  });
});

describe("McpServerManager", () => {
  let manager: McpServerManager;

  beforeEach(() => {
    resetMcpServerManager();
    manager = getMcpServerManager();
  });

  afterEach(() => {
    manager.stopAll();
    resetMcpServerManager();
  });

  it("initializes with mcpActivation disabled", () => {
    manager.initialize({ mcpActivation: false });
    const status = manager.getStatus();
    expect(status.length).toBeGreaterThan(0);
    expect(status.every((s) => s.state === "disabled")).toBe(true);
  });

  it("returns empty tools when mcpActivation is false", () => {
    manager.initialize({ mcpActivation: false });
    const tools = manager.getAllTools();
    expect(tools).toEqual([]);
  });

  it("startAll is a no-op when mcpActivation is false", async () => {
    manager.initialize({ mcpActivation: false });
    const results = await manager.startAll();
    expect(results.every((s) => s.state === "disabled")).toBe(true);
  });

  it("stopAll clears all state", () => {
    manager.initialize({ mcpActivation: false });
    manager.stopAll();
    const status = manager.getStatus();
    expect(status.every((s) => s.state === "disabled" && s.tools.length === 0)).toBe(true);
  });

  it("stopServer clears a single server", () => {
    manager.initialize({ mcpActivation: false });
    manager.stopServer("sailor");
    const status = manager.getStatus().find((s) => s.id === "sailor");
    expect(status?.state).toBe("disabled");
  });

  it("getTools returns empty for unknown server", () => {
    manager.initialize({ mcpActivation: false });
    expect(manager.getTools("nonexistent")).toEqual([]);
  });
});

describe("MCP singleton", () => {
  afterEach(() => {
    resetMcpServerManager();
  });

  it("returns the same instance", () => {
    const a = getMcpServerManager();
    const b = getMcpServerManager();
    expect(a).toBe(b);
  });

  it("reset creates a new instance", () => {
    const a = getMcpServerManager();
    resetMcpServerManager();
    const b = getMcpServerManager();
    expect(a).not.toBe(b);
  });
});
