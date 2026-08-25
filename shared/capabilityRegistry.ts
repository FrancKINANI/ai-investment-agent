import { z } from "zod";
import manifest from "./capabilityManifest.json";
import { protectedTradingAgentRoles } from "./tradingAgents";

const safeScopeSchema = z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write"]);

const capabilitySchema = z.object({
  id: z.string().regex(/^[a-z0-9.-]+$/),
  version: z.string().min(1),
  kind: z.enum(["tool", "skill", "mcp", "data_source"]),
  label: z.string().min(1).max(120),
  scopes: z.array(safeScopeSchema).min(1),
  tags: z.array(z.string().min(1).max(40)).min(1),
  state: z.enum(["active", "disabled", "planned"]),
});

const bindingSchema = z.object({
  capabilityId: z.string().regex(/^[a-z0-9.-]+$/),
  roleKeys: z.array(z.string().regex(/^[a-z0-9_-]+$/)).min(1),
  permission: z.enum(["research-only", "simulation-only"]),
});

export const capabilityManifestSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.string().min(1).max(80),
  executionBoundary: z.literal("simulation-only"),
  capabilities: z.array(capabilitySchema).min(1),
  bindings: z.array(bindingSchema).min(1),
}).superRefine((value, context) => {
  const capabilityIds = new Set(value.capabilities.map((capability) => capability.id));
  if (capabilityIds.size !== value.capabilities.length) {
    context.addIssue({ code: "custom", message: "Capability identifiers must be unique." });
  }
  for (const binding of value.bindings) {
    if (!capabilityIds.has(binding.capabilityId)) {
      context.addIssue({ code: "custom", message: `Binding references an unknown capability: ${binding.capabilityId}.` });
    }
  }
});

export const capabilityRegistry = capabilityManifestSchema.parse(manifest);

export type CapabilityRegistry = typeof capabilityRegistry;

export const capabilityBindingDraftSchema = z.object({
  capabilityId: z.string().regex(/^[a-z0-9.-]+$/),
  roleKeys: z.array(z.string().regex(/^[a-z0-9_-]+$/)).min(1).max(protectedTradingAgentRoles.length),
  permission: z.enum(["research-only", "simulation-only"]),
});

export type CapabilityBindingDraft = z.infer<typeof capabilityBindingDraftSchema>;

export type CapabilityProvenance = {
  origin: "capability-registry" | "owner-control";
  actor: "authenticated-owner";
  registryRevision: string;
  executionBoundary: "simulation-only";
  capabilities: Array<{ id: string; version: string; label: string; scopes: string[] }>;
};

const registryCapabilitiesById = new Map(capabilityRegistry.capabilities.map((capability) => [capability.id, capability]));

/**
 * Validates a staged binding before any maintainer changes the immutable manifest.
 * This phase deliberately has no write path to runtime authority, MCP, credentials,
 * signing, custody, or live execution.
 */
export function validateCapabilityBindingDraft(input: CapabilityBindingDraft) {
  const draft = capabilityBindingDraftSchema.parse(input);
  const capability = registryCapabilitiesById.get(draft.capabilityId);
  const issues: string[] = [];
  const roleKeys = Array.from(new Set(draft.roleKeys));
  if (!capability) issues.push("Choose a capability declared in the active manifest.");
  if (capability?.state !== "active") issues.push("Only an active manifest capability can be staged for a binding.");
  if (capability?.kind === "mcp") issues.push("MCP capabilities are not accepted by this simulation-only registry.");
  if (draft.permission === "research-only" && capability?.scopes.includes("proposal.write")) {
    issues.push("A proposal-writing capability requires the simulation-only permission boundary.");
  }
  for (const roleKey of roleKeys) {
    const role = protectedTradingAgentRoles.find((candidate) => candidate.roleKey === roleKey);
    if (!role) {
      issues.push(`Unknown or optional role: ${roleKey}. Bindings may target protected TradingAgents roles only.`);
      continue;
    }
    if (capability && !capability.scopes.every((scope) => (role.tools as readonly string[]).includes(scope))) {
      issues.push(`${role.name} does not have the safe scope required by ${capability.label}.`);
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    normalized: { ...draft, roleKeys },
    capability: capability ? { id: capability.id, version: capability.version, label: capability.label, scopes: capability.scopes } : null,
    executionBoundary: capabilityRegistry.executionBoundary,
  };
}

/** Builds immutable, human-readable source metadata for each owner activity action. */
export function createCapabilityProvenance(capabilityIds: string[] = []): CapabilityProvenance {
  const capabilities = Array.from(new Set(capabilityIds))
    .map((capabilityId) => registryCapabilitiesById.get(capabilityId))
    .filter((capability): capability is NonNullable<typeof capability> => Boolean(capability))
    .map((capability) => ({ id: capability.id, version: capability.version, label: capability.label, scopes: [...capability.scopes] }));
  return {
    origin: capabilities.length ? "capability-registry" : "owner-control",
    actor: "authenticated-owner",
    registryRevision: capabilityRegistry.revision,
    executionBoundary: capabilityRegistry.executionBoundary,
    capabilities,
  };
}

export function getCapabilityRegistrySummary() {
  const activeCapabilities = capabilityRegistry.capabilities.filter((capability) => capability.state === "active");
  return {
    schemaVersion: capabilityRegistry.schemaVersion,
    revision: capabilityRegistry.revision,
    executionBoundary: capabilityRegistry.executionBoundary,
    capabilityCount: capabilityRegistry.capabilities.length,
    activeCapabilityCount: activeCapabilities.length,
    mcpCapabilityCount: capabilityRegistry.capabilities.filter((capability) => capability.kind === "mcp").length,
    capabilities: capabilityRegistry.capabilities,
    bindings: capabilityRegistry.bindings,
  };
}
