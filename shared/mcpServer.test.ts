import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { McpServerManager, getMcpServerManager, resetMcpServerManager, mcpConfigFileSchema, isSafeMcpUrl } from "./mcpServer";

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

describe("LL-SEC-004: MCP SSRF URL validation", () => {
  it("blocks localhost", () => {
    expect(isSafeMcpUrl("http://localhost:8080/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("http://127.0.0.1:8080/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("http://[::1]:8080/mcp").safe).toBe(false);
  });

  it("blocks cloud metadata endpoints", () => {
    expect(isSafeMcpUrl("http://169.254.169.254/latest/meta-data/").safe).toBe(false);
    expect(isSafeMcpUrl("http://metadata.google.internal/computeMetadata/v1/").safe).toBe(false);
  });

  it("blocks private IPv4 ranges", () => {
    expect(isSafeMcpUrl("http://10.0.0.1:8080/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("http://172.16.0.1:8080/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("http://172.31.255.255:8080/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("http://192.168.1.1:8080/mcp").safe).toBe(false);
  });

  it("blocks link-local addresses", () => {
    expect(isSafeMcpUrl("http://169.254.1.1:8080/mcp").safe).toBe(false);
  });

  it("blocks IPv6 private addresses", () => {
    expect(isSafeMcpUrl("http://[fe80::1]:8080/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("http://[fc00::1]:8080/mcp").safe).toBe(false);
  });

  it("blocks internal hostnames", () => {
    expect(isSafeMcpUrl("http://myserver.internal:8080/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("http://service.local:8080/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("http://app.localhost:8080/mcp").safe).toBe(false);
  });

  it("blocks non-http protocols", () => {
    expect(isSafeMcpUrl("ftp://example.com/mcp").safe).toBe(false);
    expect(isSafeMcpUrl("file:///etc/passwd").safe).toBe(false);
  });

  it("allows public HTTPS URLs", () => {
    expect(isSafeMcpUrl("https://api.example.com/mcp").safe).toBe(true);
    expect(isSafeMcpUrl("https://mcp-server.example.org:8443/sse").safe).toBe(true);
  });

  it("allows public HTTP URLs", () => {
    expect(isSafeMcpUrl("http://8.8.8.8:8080/mcp").safe).toBe(true);
    expect(isSafeMcpUrl("http://203.0.113.1/mcp").safe).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isSafeMcpUrl("not-a-url").safe).toBe(false);
    expect(isSafeMcpUrl("").safe).toBe(false);
  });
});
