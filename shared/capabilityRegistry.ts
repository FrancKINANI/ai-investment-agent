import { z } from "zod";
import manifest from "./capabilityManifest.json";

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
