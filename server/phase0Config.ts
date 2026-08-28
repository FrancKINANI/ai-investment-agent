import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { capabilityBindingDraftSchema, getCapabilityRegistrySummary, validateCapabilityBindingDraft } from "@shared/capabilityRegistry";

const safeScopeSchema = z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write"]);
const systemDefaultsSchema = z.object({
  schemaVersion: z.literal(1), project: z.literal("Ledgerline"), profile: z.enum(["safe-phase0", "owner-os"]), executionBoundary: z.enum(["simulation-only", "fail-closed"]),
  featureFlags: z.object({ researchSources: z.literal(true), supervisor: z.literal(true), strategyEvolution: z.boolean(), predictionMarkets: z.literal(false), cexExecution: z.boolean(), mcpActivation: z.literal(false), liveExecution: z.boolean() }).strict(),
  memory: z.object({ backend: z.literal("owner-journal"), remoteAccess: z.literal(false) }).strict(),
  lineage: z.object({ backend: z.literal("database"), retainVersions: z.number().int().min(1).max(500) }).strict(),
  orchestration: z.object({ engine: z.literal("protected-fabric"), dynamicConfiguration: z.boolean() }).strict(),
}).strict();
const systemProfileSchema = z.object({ schemaVersion: z.literal(1), name: z.string().min(1).max(120), executionBoundary: z.enum(["simulation-only", "fail-closed"]), overridePolicy: z.string().min(1).max(120), notes: z.string().min(20).max(800) }).strict();
const sourceSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1).max(120), type: z.literal("data_source"), state: z.enum(["active", "disabled"]), capabilityId: z.string().regex(/^[a-z0-9.-]+$/), tags: z.array(z.string().min(1).max(40)).min(1), scopes: z.array(safeScopeSchema).min(1), connection: z.literal("server-managed-public-data") }).strict();
const sourceFileSchema = z.object({ schemaVersion: z.literal(1), sources: z.array(sourceSchema).min(1) }).strict();
const mcpServerSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1).max(120), type: z.literal("mcp_server"), state: z.literal("disabled"), registration: z.literal("declarative-only"), transport: z.literal("not-configured"), tags: z.array(z.string().min(1).max(40)).min(1), reason: z.string().min(20).max(800) }).strict();
const mcpFileSchema = z.object({ schemaVersion: z.literal(1), servers: z.array(mcpServerSchema) }).strict();
const declaredBindingSchema = z.object({
  capabilityId: z.string().regex(/^[a-z0-9.-]+$/),
  roleKeys: z.array(z.string().regex(/^[a-z0-9_-]+$/)).min(1).max(64),
  permission: z.enum(["research-only", "simulation-only", "execution"]),
});
const bindingsFileSchema = z.object({ schemaVersion: z.literal(1), bindings: z.array(declaredBindingSchema).min(1) }).strict();

function loadYamlFile(relativePath: string): unknown {
  const path = resolve(process.cwd(), "config", relativePath);
  try { return parseYaml(readFileSync(path, "utf8")); }
  catch (error) { throw new Error(`Ledgerline configuration could not read ${relativePath}: ${error instanceof Error ? error.message : "unknown error"}`); }
}

function ensureUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`Ledgerline configuration contains duplicate ${label}.`);
}

export function loadPhase0Configuration() {
  const defaults = systemDefaultsSchema.parse(loadYamlFile("default.yaml"));
  const system = systemProfileSchema.parse(loadYamlFile("system.yaml"));
  const sources = sourceFileSchema.parse(loadYamlFile("capabilities/research-sources.yaml"));
  const mcp = mcpFileSchema.parse(loadYamlFile("capabilities/mcp-servers.yaml"));
  const bindings = bindingsFileSchema.parse(loadYamlFile("bindings/protected-roles.yaml"));
  ensureUnique(sources.sources.map((source) => source.id), "research source identifiers");
  ensureUnique(mcp.servers.map((server) => server.id), "MCP declaration identifiers");
  const registry = getCapabilityRegistrySummary();
  const declaredCapabilityIds = new Set(registry.capabilities.map((capability) => capability.id));
  for (const source of sources.sources) if (!declaredCapabilityIds.has(source.capabilityId)) throw new Error(`Research source ${source.id} references a missing registry capability.`);
  for (const binding of bindings.bindings) {
    if (binding.permission === "execution") {
      if (defaults.featureFlags.liveExecution || defaults.featureFlags.cexExecution || defaults.executionBoundary !== "fail-closed") {
        throw new Error(`Execution binding ${binding.capabilityId} is forbidden outside the fail-closed static declaration boundary.`);
      }
      continue;
    }
    const validation = validateCapabilityBindingDraft(binding);
    if (!validation.valid) throw new Error(`Invalid protected binding ${binding.capabilityId}: ${validation.issues.join(" ")}`);
  }
  return { defaults, system, sources, mcp, bindings, registry };
}

export function getPhase0ConfigurationSummary() {
  const configuration = loadPhase0Configuration();
  return {
    project: configuration.defaults.project,
    profile: configuration.defaults.profile,
    schemaVersion: configuration.defaults.schemaVersion,
    executionBoundary: configuration.defaults.executionBoundary,
    featureFlags: configuration.defaults.featureFlags,
    orchestration: configuration.defaults.orchestration,
    researchSources: configuration.sources.sources.map((source) => ({ id: source.id, label: source.label, state: source.state, capabilityId: source.capabilityId, scopes: source.scopes })),
    mcpServers: configuration.mcp.servers.map((server) => ({ id: server.id, label: server.label, state: server.state, registration: server.registration, transport: server.transport, reason: server.reason })),
    bindingCount: configuration.bindings.bindings.length,
    activeMcpCapabilityCount: configuration.registry.mcpCapabilityCount,
    dynamicConfiguration: configuration.defaults.orchestration.dynamicConfiguration,
  };
}
