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

// ─── SSRF Protection ───────────────────────────────────────────────────────

/**
 * LL-SEC-004 FIX: Validate MCP HTTP URLs against SSRF risks.
 * Rejects localhost, private ranges, link-local, and cloud metadata IPs.
 */
export function isSafeMcpUrl(urlString: string): { safe: boolean; reason?: string } {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { safe: false, reason: `Protocol "${url.protocol}" is not allowed. Only http/https.` };
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
      return { safe: false, reason: "localhost/loopback addresses are blocked (SSRF protection)." };
    }

    // Block cloud metadata endpoints
    if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
      return { safe: false, reason: "Cloud metadata endpoints are blocked (SSRF protection)." };
    }

    // Block private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      if (a === 10) return { safe: false, reason: "Private IP range (10.x.x.x) is blocked." };
      if (a === 172 && b >= 16 && b <= 31) return { safe: false, reason: "Private IP range (172.16-31.x.x) is blocked." };
      if (a === 192 && b === 168) return { safe: false, reason: "Private IP range (192.168.x.x) is blocked." };
      if (a === 0) return { safe: false, reason: "Invalid IP range (0.x.x.x) is blocked." };
      if (a >= 224) return { safe: false, reason: "Multicast/reserved IP range is blocked." };
    }

    // Block link-local (169.254.x.x — besides metadata already caught)
    if (hostname.startsWith("169.254.")) {
      return { safe: false, reason: "Link-local IP range (169.254.x.x) is blocked." };
    }

    // Block IPv6 private/link-local (fe80::, fc00::, fd00::)
    // hostname may include brackets for IPv6 (e.g., [fe80::1])
    const cleanHost = hostname.replace(/^\[|\]$/g, "");
    if (cleanHost.startsWith("fe80:") || cleanHost.startsWith("fc00:") || cleanHost.startsWith("fd00:")) {
      return { safe: false, reason: "IPv6 private/link-local addresses are blocked." };
    }

    // Block obvious internal hostnames
    const blockedHostnames = [".internal", ".local", ".localhost", ".corp", ".lan", "internal", "local"];
    for (const suffix of blockedHostnames) {
      if (hostname === suffix.replace(".", "") || hostname.endsWith(suffix)) {
        return { safe: false, reason: `Internal hostname pattern "${suffix}" is blocked.` };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Invalid URL format." };
  }
}

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
   * Get status of all servers.
   */
  getAllStatus(): McpServerStatus[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get status of all servers or a specific server.
   * Called without args: returns all statuses (for backward compatibility).
   * Called with id: returns a single status.
   */
  getStatus(): McpServerStatus[];
  getStatus(id: string): McpServerStatus | undefined;
  getStatus(id?: string): McpServerStatus[] | McpServerStatus | undefined {
    if (id === undefined) {
      return Array.from(this.servers.values());
    }
    return this.servers.get(id);
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
      }
      this.processes.delete(config.id);
    });

    try {
      const tools = await this.discoverTools(child, config.id);
      status.state = "active";
      status.tools = tools;
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
   * LL-SEC-004: Validates URL against SSRF before connecting.
   */
  private async startHttpServer(config: McpServerConfig, status: McpServerStatus): Promise<McpServerStatus> {
    // LL-SEC-004 FIX: Validate URL against SSRF risks before fetching
    const urlCheck = isSafeMcpUrl(config.url!);
    if (!urlCheck.safe) {
      status.state = "failed";
      status.error = `SSRF protection: ${urlCheck.reason}`;
      return status;
    }

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
            inputSchema: (t.inputSchema as Record<string, unknown>) ?? {},
          });
        }
      }
    }

    console.info(`[MCP] Server ${serverId} discovered ${tools.length} tools`);
    return tools;
  }

  /**
   * Send a JSON-RPC request and wait for a response.
   */
  private sendRequest(child: ChildProcess, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1000000);
      const request = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";

      const timeout = setTimeout(() => {
        reject(new Error(`MCP request ${method} timed out after 10s`));
      }, 10000);

      const onData = (data: Buffer) => {
        try {
          const lines = data.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            const msg = JSON.parse(line);
            if (msg.id === id) {
              clearTimeout(timeout);
              child.stdout?.off("data", onData);
              if (msg.error) {
                reject(new Error(`MCP error: ${msg.error.message}`));
              } else {
                resolve(msg.result);
              }
              return;
            }
          }
        } catch {
          // Not JSON or not our response — ignore
        }
      };

      child.stdout?.on("data", onData);
      child.stdin?.write(request);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  private sendNotification(child: ChildProcess, method: string, params: unknown): void {
    const notification = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
    child.stdin?.write(notification);
  }

  /**
   * Kill a specific server process.
   */
  killServer(id: string): void {
    const child = this.processes.get(id);
    if (child) {
      child.kill();
      this.processes.delete(id);
    }
    const status = this.servers.get(id);
    if (status) {
      status.state = "disabled";
    }
  }

  /**
   * Get all discovered tools across all servers.
   */
  getAllTools(): McpTool[] {
    const allTools: McpTool[] = [];
    for (const tools of this.toolsByServer.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  /**
   * Get tools for a specific server.
   */
  getTools(id: string): McpTool[] {
    return this.toolsByServer.get(id) ?? [];
  }

  /**
   * Stop a specific server (alias for killServer).
   */
  stopServer(id: string): void {
    this.killServer(id);
  }

  /**
   * Stop all running servers.
   */
  stopAll(): void {
    for (const [id] of this.processes) {
      this.killServer(id);
    }
  }

  /**
   * Load MCP server configuration.
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
