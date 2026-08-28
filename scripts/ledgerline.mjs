#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const root = process.cwd();
const load = (relativePath) => parseYaml(readFileSync(resolve(root, "config", relativePath), "utf8"));
const fail = (message) => { console.error(`Ledgerline: ${message}`); process.exitCode = 1; };
const print = (value) => console.log(JSON.stringify(value, null, 2));

function configuration() {
  const defaults = load("default.yaml");
  const system = load("system.yaml");
  const sources = load("capabilities/research-sources.yaml");
  const mcp = load("capabilities/mcp-servers.yaml");
  const bindings = load("bindings/protected-roles.yaml");
  const agents = load("agents/team.yaml");
  if (defaults?.project !== "Ledgerline" || defaults?.executionBoundary !== "fail-closed") throw new Error("the safe execution boundary is invalid");
  if (system?.executionBoundary !== "fail-closed") throw new Error("the system profile must declare fail-closed execution boundary");
  if (!Array.isArray(mcp?.servers)) throw new Error("MCP declarations are malformed");
  if (!Array.isArray(sources?.sources) || !Array.isArray(bindings?.bindings) || !Array.isArray(agents?.agents)) throw new Error("source, binding, or agent documents are malformed");
  return { defaults, system, sources, mcp, bindings, agents };
}

function validateMcpServers(config, requireDisabled) {
  if (requireDisabled) {
    return config.mcp.servers.every(
      (server) => server.state === "disabled" && server.registration === "declarative-only" && server.transport === "not-configured" && !("command" in server) && !("url" in server)
    );
  }
  return config.mcp.servers.every((server) => {
    if (server.state === "disabled") return true;
    if (server.state === "active" && server.registration === "dynamic") {
      if (server.transport === "stdio") return Boolean(server.command);
      if (server.transport === "sse" || server.transport === "streamable-http") return Boolean(server.url);
    }
    return false;
  });
}

function command() {
  const args = process.argv.slice(2);
  const config = configuration();
  const mcpActive = config.defaults?.featureFlags?.mcpActivation === true;

  if (args[0] === "doctor") {
    const checks = [
      { id: "yaml-schema", status: "pass", detail: "All YAML documents parsed and passed the safe contract." },
      { id: "execution-boundary", status: config.defaults.executionBoundary === "fail-closed" && config.system.executionBoundary === "fail-closed" ? "pass" : "block", detail: `Defaults and system profile declare ${config.defaults.executionBoundary}.` },
      { id: "authority-flags", status: config.defaults.featureFlags?.cexExecution === false && config.defaults.featureFlags?.liveExecution === false ? "pass" : "review", detail: "CEX and live execution flags checked." },
      { id: "mcp-declarations", status: validateMcpServers(config, !mcpActive) ? "pass" : "block", detail: mcpActive ? `${config.mcp.servers.length} MCP servers (activation enabled)` : `${config.mcp.servers.length} declarative MCP entries are disabled and connection-free.` },
      { id: "research-sources", status: config.sources.sources.every((source) => source.state === "active" && source.connection === "server-managed-public-data") ? "pass" : "review", detail: `${config.sources.sources.length} public research-source declarations are available.` },
      { id: "protected-bindings", status: config.bindings.bindings.length > 0 ? "pass" : "block", detail: `${config.bindings.bindings.length} protected role bindings are available for validation.` },
    ];
    return print({ healthy: checks.every((check) => check.status === "pass"), project: config.defaults.project, profile: config.defaults.profile, executionBoundary: config.defaults.executionBoundary, mcpActivation: mcpActive, checks, note: mcpActive ? "MCP activation is enabled. Active servers may be spawned." : "Doctor is inspection-only. No MCP processes are spawned." });
  }
  if (args[0] === "config" && args[1] === "validate") return print({ valid: true, project: config.defaults.project, profile: config.defaults.profile, executionBoundary: config.defaults.executionBoundary, mcpActivation: mcpActive, activeMcpServers: mcpActive ? config.mcp.servers.filter((s) => s.state === "active").length : 0, note: mcpActive ? "MCP activation enabled. Active servers may be spawned at runtime." : "Inspection only; no MCP execution." });
  if (args[0] === "config" && args[1] === "show") {
    const section = args[2] ?? "all";
    const views = { all: config, system: { defaults: config.defaults, system: config.system }, sources: config.sources, capabilities: { sources: config.sources.sources, mcpServers: config.mcp.servers }, mcp: config.mcp, bindings: config.bindings, agents: config.agents };
    if (!(section in views)) throw new Error(`unknown config section: ${section}`);
    return print(views[section]);
  }
  if (args[0] === "agents" && args[1] === "list") {
    const filterLayer = args.includes("--layer") ? args[args.indexOf("--layer") + 1] : undefined;
    const filterEnabled = args.includes("--enabled-only");
    let agents = config.agents.agents;
    if (filterLayer) agents = agents.filter((agent) => agent.layer === filterLayer);
    if (filterEnabled) agents = agents.filter((agent) => agent.enabled);
    return print({
      schemaVersion: config.agents.schemaVersion,
      defaultModel: config.agents.defaultModel,
      defaultProvider: config.agents.defaultProvider,
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        layer: agent.layer,
        enabled: agent.enabled,
        model: agent.model ?? config.agents.defaultModel,
        provider: agent.provider ?? config.agents.defaultProvider,
        canVeto: agent.canVeto,
        canExecute: agent.canExecute,
        capabilities: agent.capabilities,
      })),
    });
  }
  if (args[0] === "capabilities" && args[1] === "list") {
    const type = args.includes("--type") ? args[args.indexOf("--type") + 1] : undefined;
    const agent = args.includes("--agent") ? args[args.indexOf("--agent") + 1] : undefined;
    let capabilities = [...config.sources.sources, ...config.mcp.servers];
    if (type) capabilities = capabilities.filter((capability) => capability.type === type);
    if (agent) { const ids = config.bindings.bindings.filter((binding) => binding.roleKeys.includes(agent)).map((binding) => binding.capabilityId); capabilities = capabilities.filter((capability) => "capabilityId" in capability && ids.includes(capability.capabilityId)); }
    return print(capabilities);
  }
  if (args[0] === "bindings" && args[1] === "show") { const role = args[2]; return print(role ? config.bindings.bindings.filter((binding) => binding.roleKeys.includes(role)) : config.bindings.bindings); }
  if (args[0] === "mcp" && args[1] === "list") return print(config.mcp.servers);
  if (args[0] === "mcp" && args[1] === "status") {
    if (!mcpActive) return print({ mcpActivation: false, servers: config.mcp.servers.map((s) => ({ id: s.id, state: s.state })), note: "MCP activation is disabled. Enable featureFlags.mcpActivation to start servers." });
    const active = config.mcp.servers.filter((s) => s.state === "active");
    return print({ mcpActivation: true, activeCount: active.length, servers: config.mcp.servers.map((s) => ({ id: s.id, label: s.label, state: s.state, transport: s.transport, hasCommand: Boolean(s.command), hasUrl: Boolean(s.url) })) });
  }
  if (args[0] === "mcp" && args[1] === "start") {
    if (!mcpActive) fail("MCP activation is disabled. Set featureFlags.mcpActivation to true in config/default.yaml or config/local.yaml first.");
    const serverId = args[2];
    const toStart = serverId ? config.mcp.servers.filter((s) => s.id === serverId) : config.mcp.servers.filter((s) => s.state === "active");
    if (toStart.length === 0) fail(serverId ? `MCP server '${serverId}' not found or not active.` : "No active MCP servers to start.");
    return print({ action: "start", servers: toStart.map((s) => ({ id: s.id, label: s.label, transport: s.transport, command: s.command, url: s.url })), note: "MCP server start requested. Use 'ledgerline mcp status' to check runtime state." });
  }
  if (args[0] === "mcp" && args[1] === "stop") {
    if (!mcpActive) fail("MCP activation is disabled.");
    const serverId = args[2];
    return print({ action: "stop", serverId: serverId ?? "all", note: "MCP server stop requested." });
  }

  // ── Execution backend commands ──────────────────────────────────────────

  if (args[0] === "execution") {
    const backends = [
      {
        id: "paper",
        label: "Paper / Sandbox",
        status: "always-available",
        authorityRequired: "none",
        description: "Deterministic paper execution. No real capital. Safe for testing.",
      },
      {
        id: "cex",
        label: "Binance (Live)",
        status: config.defaults.featureFlags?.cexExecution === true ? "enabled" : "disabled-by-config",
        authorityRequired: "approval-required-live or limited-live",
        description: "Real Binance order submission. Requires active API key + mandate + authority transition.",
      },
      {
        id: "onchain",
        label: "Non-custodial On-chain",
        status: "not-implemented",
        authorityRequired: "limited-live",
        description: "Sailor / WalletConnect signing. Phase 3+ feature.",
      },
    ];

    if (args[1] === "status") {
      const cexEnabled = config.defaults.featureFlags?.cexExecution === true;
      return print({
        activeBackend: "paper",
        cexEnabled,
        cexExecutionFlag: config.defaults.featureFlags?.cexExecution ?? false,
        liveExecutionFlag: config.defaults.featureFlags?.liveExecution ?? false,
        authorityNote: "Live execution requires climbing the authority state machine (disabled → sandbox-only → read-only-live → approval-required-live).",
        backends,
        note: cexEnabled
          ? "CEX execution flag is enabled. Backend can be switched at runtime via API."
          : "CEX execution is disabled by config. Set featureFlags.cexExecution: true in config/default.yaml or config/local.yaml to enable.",
      });
    }

    if (args[1] === "list") {
      return print({ backends });
    }

    if (args[1] === "switch") {
      const target = args[2];
      if (!target) fail("Usage: ledgerline execution switch <paper|cex>");
      if (!["paper", "cex"].includes(target)) fail(`Unknown backend: "${target}". Valid options: paper, cex`);

      if (target === "cex") {
        const cexEnabled = config.defaults.featureFlags?.cexExecution === true;
        if (!cexEnabled) {
          return print({
            action: "switch-blocked",
            target: "cex",
            reason: "CEX execution is disabled by config.",
            steps: [
              "1. Set featureFlags.cexExecution: true in config/default.yaml or config/local.yaml",
              "2. Add and verify a Binance API key in Settings → Platforms",
              "3. Create a wallet mandate with mode: real for venue: binance",
              "4. Transition authority state to approval-required-live",
              "5. Restart the server or reload config",
              "6. Run: ledgerline execution switch cex",
            ],
          });
        }
        return print({
          action: "switch",
          target: "cex",
          note: "CEX backend will be active. Authority + mandate + key checks apply at execution time.",
          runtime: "Call registry.setActive('cex') via the API or Settings UI.",
        });
      }

      if (target === "paper") {
        return print({
          action: "switch",
          target: "paper",
          note: "Paper backend is now active. No real capital at risk.",
          runtime: "Call registry.setActive('paper') via the API or Settings UI.",
        });
      }
    }
  }

  throw new Error("supported commands: config validate | config show [section] | agents list [--layer LAYER] [--enabled-only] | capabilities list [--type TYPE] [--agent ROLE] | bindings show [ROLE] | mcp list | mcp status | mcp start [SERVER_ID] | mcp stop [SERVER_ID] | execution status | execution list | execution switch <paper|cex> | doctor");
}

try { command(); } catch (error) { fail(error instanceof Error ? error.message : "unknown error"); }
