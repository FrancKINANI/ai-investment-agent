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
    permission: z.enum(["research-only", "simulation-only", "execution"]),
  })).optional(),
  mcpActivation: z.boolean().optional(),
});

export type LocalOverlay = z.infer<typeof localOverlaySchema>;

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
  permission: "research-only" | "simulation-only" | "execution";
}) {
  const current = loadLocalOverlay();
  const bindings = [...(current.bindings ?? []).filter((item) => item.capabilityId !== binding.capabilityId), binding];
  writeLocalOverlay({ ...current, bindings });
  return bindings;
}
