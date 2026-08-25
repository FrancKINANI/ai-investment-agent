#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const root = process.cwd();
const load = (relativePath) => parseYaml(readFileSync(resolve(root, "config", relativePath), "utf8"));
const fail = (message) => { console.error(`Ledgerline Phase 0: ${message}`); process.exitCode = 1; };
const print = (value) => console.log(JSON.stringify(value, null, 2));

function configuration() {
  const defaults = load("default.yaml");
  const system = load("system.yaml");
  const sources = load("capabilities/research-sources.yaml");
  const mcp = load("capabilities/mcp-servers.yaml");
  const bindings = load("bindings/protected-roles.yaml");
  if (defaults?.project !== "Ledgerline" || defaults?.executionBoundary !== "simulation-only" || defaults?.featureFlags?.cexExecution !== false || defaults?.featureFlags?.mcpActivation !== false || defaults?.featureFlags?.liveExecution !== false) throw new Error("the safe execution boundary or disabled flags are invalid");
  if (system?.executionBoundary !== "simulation-only" || system?.overridePolicy !== "defaults-only") throw new Error("the system profile attempts to override safe defaults");
  if (!Array.isArray(mcp?.servers) || mcp.servers.some((server) => server.state !== "disabled" || server.registration !== "declarative-only" || server.transport !== "not-configured" || "command" in server || "url" in server)) throw new Error("MCP declarations must remain disabled and connection-free");
  if (!Array.isArray(sources?.sources) || !Array.isArray(bindings?.bindings)) throw new Error("source or binding documents are malformed");
  return { defaults, system, sources, mcp, bindings };
}

function command() {
  const args = process.argv.slice(2);
  const config = configuration();
  if (args[0] === "config" && args[1] === "validate") return print({ valid: true, project: config.defaults.project, profile: config.defaults.profile, executionBoundary: config.defaults.executionBoundary, activeMcpServers: 0, note: "Inspection only; no credentials, MCP execution, signing, custody, venue connection, or live authority." });
  if (args[0] === "config" && args[1] === "show") {
    const section = args[2] ?? "all";
    const views = { all: config, system: { defaults: config.defaults, system: config.system }, sources: config.sources, capabilities: { sources: config.sources.sources, mcpServers: config.mcp.servers }, mcp: config.mcp, bindings: config.bindings };
    if (!(section in views)) throw new Error(`unknown config section: ${section}`);
    return print(views[section]);
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
  throw new Error("supported inspection-only commands: config validate | config show [system|sources|capabilities|mcp|bindings] | capabilities list [--type mcp_server] [--agent ROLE] | bindings show [ROLE] | mcp list. Mutating or activating commands are intentionally unavailable in Phase 0.");
}

try { command(); } catch (error) { fail(error instanceof Error ? error.message : "unknown error"); }
