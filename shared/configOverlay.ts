import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { z } from "zod";
import { resolveConfigDir, tryLoadYamlFile } from "./configFiles";

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

export function loadLocalOverlay(): LocalOverlay {
  const raw = tryLoadYamlFile("local.yaml");
  if (raw == null) return {};
  const overlay = localOverlaySchema.parse(raw);
  const attemptsActivation = overlay.mcpActivation === true
    || overlay.featureFlags?.liveExecution === true
    || overlay.featureFlags?.cexExecution === true
    || overlay.featureFlags?.mcpActivation === true;
  if (attemptsActivation) {
    throw new Error("Local configuration cannot activate execution, MCP, or execution-permission bindings in a fail-closed Ledgerline build.");
  }
  return overlay;
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
