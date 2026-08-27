/**
 * Ledgerline MCP Server Manager
 *
 * Manages MCP server processes: spawn, discover tools, lifecycle, failure isolation.
 * Gated behind featureFlags.mcpActivation — no process is spawned unless explicitly enabled.
 *
 * Each MCP server is isolated: a crash in one server does not affect others.
 * Tools discovered from MCP servers are registered as capabilities in the registry.
 */

import { z } from "zod";
import { spawn, type ChildProcess } from "node:child_process";
import { loadYamlFile } from "./configFiles";

// ─── Schema ────────────────────────────────────────────────────────────────

export const mcpServerConfigSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(120),
  type: z.literal("mcp_server"),
  state: z.enum(["disabled", "active"]),
  registration: z.enum(["declarative-only", "dynamic"]),
  transport: z.enum(["not-configured", "stdio", "sse", "streamable-http"]),
  tags: z.array(z.string().min(1).max(40)).min(1),
  reason: z.string().min(10).max(800).optional(),
  // Connection details (only when state=active and transport!=not-configured)
  command: z.string().min(1).max(500).optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  env: z.record(z.string(), z.string()).optional(),
}).refine(
  (server) => {
    if (server.state === "active" && server.transport !== "not-configured") {
      // Must have either command (stdio) or url (sse/streamable-http)
      if (server.transport === "stdio") return Boolean(server.command);
      return Boolean(server.url);
    }
    return true;
  },
  { message: "Active stdio servers require 'command'. Active SSE/HTTP servers require 'url'." },
);

export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;

export const mcpConfigFileSchema = z.object({
  schemaVersion: z.literal(1),
  servers: z.array(mcpServerConfigSchema),
});

// ─── Types ─────────────────────────────────────────────────────────────────

export type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type McpServerStatus = {
  id: string;
  label: string;
  state: "disabled" | "connecting" | "active" | "failed";
  transport: string;
  tools: McpTool[];
  error?: string;
  pid?: number;
};

// ─── Manager ───────────────────────────────────────────────────────────────

/**
 * McpServerManager: lifecycle manager for MCP server processes.
 *
 * - Reads config from config/capabilities/mcp-servers.yaml
 * - Spawns servers behind the mcpActivation feature flag
 * - Discovers tools via the MCP protocol (JSON-RPC over stdio/SSE)
 * - Isolates failures per server
 */
export class McpServerManager {
  private servers = new Map<string, McpServerStatus>();
  private processes = new Map<string, ChildProcess>();
  private toolsByServer = new Map<string, McpTool[]>();
  private mcpActivation = false;

  /**
   * Initialize the manager from config.
   * Does NOT spawn any processes — call startAll() explicitly.
   */
  initialize(featureFlags: { mcpActivation: boolean }): void {
    // This build intentionally has no approved MCP execution environment.
    // Never turn this into an environment/configuration toggle: such a toggle
    // could re-enable process execution or SSRF without a security release.
    this.mcpActivation = false;
    if (featureFlags.mcpActivation) {
      throw new Error("MCP activation is sealed in this fail-closed Ledgerline build.");
    }
    const config = this.loadConfig();

    for (const server of config.servers) {
      this.servers.set(server.id, {
        id: server.id,
        label: server.label,
        state: server.state === "active" && this.mcpActivation ? "disabled" : "disabled",
        transport: server.transport,
        tools: [],
      });
    }
  }

  /**
   * Start all active MCP servers.
   * No-op if mcpActivation is false.
   */
  async startAll(): Promise<McpServerStatus[]> {
    if (!this.mcpActivation) {
      console.info("[MCP] Activation is disabled. No servers will be started.");
      return Array.from(this.servers.values());
    }

    const config = this.loadConfig();
    const results: McpServerStatus[] = [];

    for (const server of config.servers) {
      if (server.state !== "active") continue;
      if (server.transport === "not-configured") continue;

      try {
        const status = await this.startServer(server);
        results.push(status);
      } catch (error) {
        const status = this.servers.get(server.id);
        if (status) {
          status.state = "failed";
          status.error = error instanceof Error ? error.message : "Unknown error";
          results.push(status);
        }
      }
    }

    return results;
  }

  /**
   * Start a single MCP server.
   */
  private async startServer(config: McpServerConfig): Promise<McpServerStatus> {
    const status = this.servers.get(config.id);
    if (!status) throw new Error(`Unknown MCP server: ${config.id}`);

    status.state = "connecting";

    if (config.transport === "stdio" && config.command) {
      return this.startStdioServer(config, status);
    }

    if ((config.transport === "sse" || config.transport === "streamable-http") && config.url) {
      return this.startHttpServer(config, status);
    }

    throw new Error(`Unsupported transport: ${config.transport}`);
  }

  /**
   * Start an MCP server over stdio (JSON-RPC).
   * Spawns a child process and communicates via stdin/stdout.
   */
  private async startStdioServer(config: McpServerConfig, status: McpServerStatus): Promise<McpServerStatus> {
    const child = spawn(config.command!, config.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...config.env },
    });

    this.processes.set(config.id, child);
    status.pid = child.pid;

    // Set up error handling (isolation: this server's crash doesn't affect others)
    child.on("error", (error) => {
      console.error(`[MCP] Server ${config.id} error:`, error.message);
      status.state = "failed";
      status.error = error.message;
      this.processes.delete(config.id);
    });

    child.on("exit", (code) => {
      if (status.state !== "failed") {
        console.info(`[MCP] Server ${config.id} exited with code ${code}`);
        status.state = "disabled";
        status.pid = undefined;
      }
      this.processes.delete(config.id);
    });

    // Discover tools via MCP protocol
    try {
      const tools = await this.discoverTools(child, config.id);
      status.tools = tools;
      status.state = "active";
      this.toolsByServer.set(config.id, tools);
    } catch (error) {
      status.state = "failed";
      status.error = error instanceof Error ? error.message : "Tool discovery failed";
      this.killServer(config.id);
    }

    return status;
  }

  /**
   * Start an MCP server over HTTP (SSE or streamable-http).
   * For now, this is a placeholder — real implementation connects to the URL.
   */
  private async startHttpServer(config: McpServerConfig, status: McpServerStatus): Promise<McpServerStatus> {
    // HTTP transport: verify the endpoint is reachable
    try {
      const response = await fetch(config.url!, { method: "GET", signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      status.state = "active";
      // TODO: Implement full MCP protocol over SSE/streamable-http
      // For now, HTTP servers are recognized but tool discovery is not yet implemented
      console.info(`[MCP] Server ${config.id} connected at ${config.url} (tool discovery pending)`);
    } catch (error) {
      status.state = "failed";
      status.error = error instanceof Error ? error.message : "Connection failed";
    }

    return status;
  }

  /**
   * Discover tools from an MCP server via JSON-RPC over stdio.
   * Sends an `initialize` request, then `tools/list`.
   */
  private async discoverTools(child: ChildProcess, serverId: string): Promise<McpTool[]> {
    if (!child.stdin || !child.stdout) {
      throw new Error("Child process has no stdio pipes");
    }

    const response = await this.sendRequest(child, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "ledgerline", version: "0.5.0" },
    });

    // Send initialized notification
    this.sendNotification(child, "notifications/initialized", {});

    // Request tool list
    const toolsResult = await this.sendRequest(child, "tools/list", {});

    const tools: McpTool[] = [];
    if (toolsResult && typeof toolsResult === "object" && "tools" in toolsResult) {
      for (const tool of (toolsResult as { tools: unknown[] }).tools) {
        if (typeof tool === "object" && tool !== null && "name" in tool) {
          const t = tool as Record<string, unknown>;
          tools.push({
            name: String(t.name),
            description: String(t.description ?? ""),
            inputSchema: (typeof t.inputSchema === "object" && t.inputSchema !== null ? t.inputSchema : {}) as Record<string, unknown>,
          });
        }
      }
    }

    return tools;
  }

  /**
   * Send a JSON-RPC request and wait for the response.
   */
  private sendRequest(child: ChildProcess, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 100000);
      const request = { jsonrpc: "2.0", id, method, params };
      const timeout = setTimeout(() => reject(new Error(`Request ${method} timed out`)), 10000);

      const onData = (data: Buffer) => {
        try {
          const messages = data.toString().split("\n").filter(Boolean);
          for (const raw of messages) {
            const msg = JSON.parse(raw);
            if (msg.id === id) {
              clearTimeout(timeout);
              child.stdout?.off("data", onData);
              if (msg.error) reject(new Error(msg.error.message ?? "MCP error"));
              else resolve(msg.result);
              return;
            }
          }
        } catch {
          // Not JSON or not our response — ignore
        }
      };

      child.stdout?.on("data", onData);
      child.stdin?.write(JSON.stringify(request) + "\n");
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  private sendNotification(child: ChildProcess, method: string, params: unknown): void {
    const notification = { jsonrpc: "2.0", method, params };
    child.stdin?.write(JSON.stringify(notification) + "\n");
  }

  /**
   * Stop a single MCP server.
   */
  stopServer(serverId: string): void {
    this.killServer(serverId);
    const status = this.servers.get(serverId);
    if (status) {
      status.state = "disabled";
      status.tools = [];
      status.pid = undefined;
      status.error = undefined;
    }
    this.toolsByServer.delete(serverId);
  }

  /**
   * Stop all running MCP servers.
   */
  stopAll(): void {
    for (const serverId of this.processes.keys()) {
      this.killServer(serverId);
    }
    for (const [id, status] of this.servers) {
      status.state = "disabled";
      status.tools = [];
      status.pid = undefined;
      status.error = undefined;
    }
    this.toolsByServer.clear();
  }

  /**
   * Kill a server process.
   */
  private killServer(serverId: string): void {
    const child = this.processes.get(serverId);
    if (child) {
      try {
        child.kill("SIGTERM");
        // Force kill after 5 seconds if still alive
        setTimeout(() => {
          try { child.kill("SIGKILL"); } catch { /* already dead */ }
        }, 5000);
      } catch { /* already dead */ }
      this.processes.delete(serverId);
    }
  }

  /**
   * Get the status of all servers.
   */
  getStatus(): McpServerStatus[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get tools discovered from a specific server.
   */
  getTools(serverId: string): McpTool[] {
    return this.toolsByServer.get(serverId) ?? [];
  }

  /**
   * Get all discovered tools across all active servers.
   */
  getAllTools(): Array<McpTool & { serverId: string }> {
    const allTools: Array<McpTool & { serverId: string }> = [];
    for (const [serverId, tools] of this.toolsByServer) {
      for (const tool of tools) {
        allTools.push({ ...tool, serverId });
      }
    }
    return allTools;
  }

  /**
   * Load MCP server config from YAML.
   */
  private loadConfig() {
    const raw = loadYamlFile("capabilities/mcp-servers.yaml");
    const config = mcpConfigFileSchema.parse(raw);
    for (const server of config.servers) {
      if (
        server.state !== "disabled"
        || server.registration !== "declarative-only"
        || server.transport !== "not-configured"
        || server.command
        || server.args?.length
        || server.url
        || (server.env && Object.keys(server.env).length > 0)
      ) {
        throw new Error(`MCP server ${server.id} is not permitted in this sealed build.`);
      }
    }
    return config;
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let manager: McpServerManager | null = null;

export function getMcpServerManager(): McpServerManager {
  if (!manager) {
    manager = new McpServerManager();
  }
  return manager;
}

export function resetMcpServerManager(): void {
  if (manager) {
    manager.stopAll();
    manager = null;
  }
}
