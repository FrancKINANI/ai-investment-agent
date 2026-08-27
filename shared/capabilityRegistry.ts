import { z } from "zod";
import { findTeamRole, isProtectedTeamRole, listProtectedTeamRoles } from "./agentTeam";
import { loadYamlFile } from "./configFiles";
import { loadLocalOverlay } from "./configOverlay";

const safeScopeSchema = z.enum(["market.read", "portfolio.read", "chain.read", "proposal.write"]);
const capabilityKindSchema = z.enum(["tool", "skill", "mcp", "mcp_server", "mcp_tool", "data_source", "sub_agent", "evaluator", "memory", "custom"]);

const capabilitySchema = z.object({
  id: z.string().regex(/^[a-z0-9.-]+$/),
  version: z.string().min(1),
  kind: capabilityKindSchema,
  label: z.string().min(1).max(120),
  scopes: z.array(safeScopeSchema).min(1),
  tags: z.array(z.string().min(1).max(40)).min(1),
  state: z.enum(["active", "disabled", "planned"]),
});

const bindingSchema = z.object({
  capabilityId: z.string().regex(/^[a-z0-9.-]+$/),
  roleKeys: z.array(z.string().regex(/^[a-z0-9_-]+$/)).min(1),
  permission: z.enum(["research-only", "simulation-only", "execution"]),
});

export const capabilityManifestSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.string().min(1).max(80),
  executionBoundary: z.enum(["fail-closed", "simulation-only"]),
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

export type CapabilityRegistry = z.infer<typeof capabilityManifestSchema>;
export type CapabilityBindingDraft = z.infer<typeof bindingSchema>;

function bindingRespectsBoundary(
  registry: CapabilityRegistry,
  binding: CapabilityBindingDraft,
  capability: { scopes: string[] },
) {
  if (binding.permission === "execution") return false;
  if (capability.scopes.includes("proposal.write") && binding.permission !== "simulation-only") return false;
  return registry.executionBoundary === "simulation-only" || registry.executionBoundary === "fail-closed";
}

export const capabilityBindingDraftSchema = bindingSchema.extend({
  roleKeys: z.array(z.string().regex(/^[a-z0-9_-]+$/)).min(1).max(64),
  permission: z.enum(["research-only", "simulation-only"]),
});

export type CapabilityProvenance = {
  origin: "capability-registry" | "owner-control";
  actor: "authenticated-owner";
  registryRevision: string;
  executionBoundary: CapabilityRegistry["executionBoundary"];
  capabilities: Array<{ id: string; version: string; label: string; scopes: string[] }>;
};

let cached: CapabilityRegistry | null = null;

function mergeOverlay(base: CapabilityRegistry): CapabilityRegistry {
  const overlay = loadLocalOverlay();
  if (!overlay.bindings?.length) return base;
  const byId = new Map(base.bindings.map((binding) => [binding.capabilityId, binding]));
  for (const binding of overlay.bindings) {
    byId.set(binding.capabilityId, binding);
  }
  return capabilityManifestSchema.parse({ ...base, bindings: [...byId.values()] });
}

export function loadCapabilityRegistry(): CapabilityRegistry {
  if (cached) return cached;
  const file = capabilityManifestSchema.parse(loadYamlFile("capabilities/registry.yaml"));
  cached = mergeOverlay(file);
  return cached;
}

export function reloadCapabilityRegistry(): CapabilityRegistry {
  cached = null;
  return loadCapabilityRegistry();
}

export const capabilityRegistry = new Proxy({} as CapabilityRegistry, {
  get(_target, property, receiver) {
    return Reflect.get(loadCapabilityRegistry(), property, receiver);
  },
}) as CapabilityRegistry;

function capabilitiesById() {
  return new Map(loadCapabilityRegistry().capabilities.map((capability) => [capability.id, capability]));
}

export function roleMayUseCapability(roleKey: string, capabilityId: string) {
  const registry = loadCapabilityRegistry();
  const capability = capabilitiesById().get(capabilityId);
  if (!capability || capability.state !== "active") return false;
  return registry.bindings.some((binding) => binding.capabilityId === capabilityId && binding.roleKeys.includes(roleKey) && bindingRespectsBoundary(registry, binding, capability));
}

export function assertRoleMayUseCapability(roleKey: string, capabilityId: string) {
  if (!roleMayUseCapability(roleKey, capabilityId)) {
    throw new Error(`Role ${roleKey} is not bound to active capability ${capabilityId}.`);
  }
}

export function validateCapabilityBindingDraft(input: CapabilityBindingDraft) {
  const draft = capabilityBindingDraftSchema.parse(input);
  const registry = loadCapabilityRegistry();
  const capability = capabilitiesById().get(draft.capabilityId);
  const issues: string[] = [];
  const roleKeys = Array.from(new Set(draft.roleKeys));
  if (!capability) issues.push("Choose a capability declared in the active manifest.");
  if (capability?.state !== "active") issues.push("Only an active manifest capability can be staged for a binding.");
  if (draft.permission === "research-only" && capability?.scopes.includes("proposal.write")) {
    issues.push("A proposal-writing capability requires the simulation-only or execution permission boundary.");
  }
  for (const roleKey of roleKeys) {
    const role = findTeamRole(roleKey);
    if (!role || !isProtectedTeamRole(roleKey)) {
      issues.push(`Unknown or optional role: ${roleKey}. Bindings may target protected team roles only.`);
      continue;
    }
    if (capability && !capability.scopes.every((scope) => role.tools.includes(scope))) {
      issues.push(`${role.name} does not have the safe scope required by ${capability.label}.`);
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    normalized: { ...draft, roleKeys },
    capability: capability ? { id: capability.id, version: capability.version, label: capability.label, scopes: capability.scopes } : null,
    executionBoundary: registry.executionBoundary,
  };
}

export function createCapabilityProvenance(capabilityIds: string[] = []): CapabilityProvenance {
  const registry = loadCapabilityRegistry();
  const byId = capabilitiesById();
  const capabilities = Array.from(new Set(capabilityIds))
    .map((capabilityId) => byId.get(capabilityId))
    .filter((capability): capability is NonNullable<typeof capability> => Boolean(capability))
    .map((capability) => ({ id: capability.id, version: capability.version, label: capability.label, scopes: [...capability.scopes] }));
  return {
    origin: capabilities.length ? "capability-registry" : "owner-control",
    actor: "authenticated-owner",
    registryRevision: registry.revision,
    executionBoundary: registry.executionBoundary,
    capabilities,
  };
}

export function getCapabilityRegistrySummary() {
  const registry = loadCapabilityRegistry();
  const activeCapabilities = registry.capabilities.filter((capability) => capability.state === "active");
  return {
    schemaVersion: registry.schemaVersion,
    revision: registry.revision,
    executionBoundary: registry.executionBoundary,
    capabilityCount: registry.capabilities.length,
    activeCapabilityCount: activeCapabilities.length,
    mcpCapabilityCount: registry.capabilities.filter((capability) => capability.kind === "mcp" || capability.kind === "mcp_server" || capability.kind === "mcp_tool").length,
    capabilities: registry.capabilities,
    bindings: registry.bindings,
    protectedRoles: listProtectedTeamRoles().map((role) => role.roleKey),
  };
}

/** 
 * Verify that a role has access to all required capabilities for a given operation.
 * Throws if any capability is missing or inactive.
 * Returns the list of capabilities used for journaling.
 */
export function validateCapabilityAccess(roleKey: string, requiredCapabilities: string[]): string[] {
  const registry = loadCapabilityRegistry();
  const capabilitiesById = new Map(registry.capabilities.map((c) => [c.id, c]));
  
  for (const capId of requiredCapabilities) {
    const capability = capabilitiesById.get(capId);
    if (!capability) {
      throw new Error(`Capability ${capId} not found in registry.`);
    }
    if (capability.state !== "active") {
      throw new Error(`Capability ${capId} (${capability.label}) is not active.`);
    }
    const hasBinding = registry.bindings.some(
      (binding) => binding.capabilityId === capId && binding.roleKeys.includes(roleKey) && bindingRespectsBoundary(registry, binding, capability)
    );
    if (!hasBinding) {
      throw new Error(`Role ${roleKey} is not bound to capability ${capId}.`);
    }
  }
  
  return requiredCapabilities;
}
