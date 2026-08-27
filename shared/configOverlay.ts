import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { z } from "zod";
import { resolveConfigDir, tryLoadYamlFile } from "./configFiles";

/**
 * LL-SEC-003 FIX: Overlay only allows research-only and simulation-only permissions.
 * Execution-level bindings require the staged workflow (requestBindingChange → review).
 * This prevents the overlay from silently granting execution authority.
 */
const OVERLAY_PERMISSIONS = ["research-only", "simulation-only"] as const;

export const localOverlaySchema = z.object({
  schemaVersion: z.literal(1).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  bindings: z.array(z.object({
    capabilityId: z.string(),
    roleKeys: z.array(z.string()).min(1),
    permission: z.enum(["research-only", "simulation-only"]),
  })).optional(),
  mcpActivation: z.boolean().optional(),
});

export type LocalOverlay = z.infer<typeof localOverlaySchema>;

/**
 * Validate an overlay binding against the security policy.
 * Returns { valid, reason } — if invalid, the binding must be rejected.
 */
export function validateOverlayBinding(binding: {
  capabilityId: string;
  roleKeys: string[];
  permission: string;
}): { valid: boolean; reason?: string } {
  if (!(OVERLAY_PERMISSIONS as readonly string[]).includes(binding.permission)) {
    return {
      valid: false,
      reason: `Permission "${binding.permission}" is not allowed in local.yaml overlay. Only ${OVERLAY_PERMISSIONS.join(", ")} are permitted. Execution-level bindings require the staged requestBindingChange workflow.`,
    };
  }
  return { valid: true };
}

export function loadLocalOverlay(): LocalOverlay {
  const raw = tryLoadYamlFile("local.yaml");
  if (raw == null) return {};
  return localOverlaySchema.parse(raw);
}

export function writeLocalOverlay(overlay: LocalOverlay) {
  const path = resolve(resolveConfigDir(), "local.yaml");
  const next = localOverlaySchema.parse({ schemaVersion: 1, ...overlay });
  writeFileSync(path, stringifyYaml(next), "utf8");
}

export function upsertOverlayBinding(binding: {
  capabilityId: string;
  roleKeys: string[];
  permission: "research-only" | "simulation-only";
}) {
  const current = loadLocalOverlay();
  const bindings = [...(current.bindings ?? []).filter((item) => item.capabilityId !== binding.capabilityId), binding];
  writeLocalOverlay({ ...current, bindings });
  return bindings;
}
