import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

export function resolveConfigDir(): string {
  const fromModule = resolve(dirname(fileURLToPath(import.meta.url)), "../config");
  if (existsSync(fromModule)) return fromModule;
  const fromCwd = resolve(process.cwd(), "config");
  if (existsSync(fromCwd)) return fromCwd;
  throw new Error("Ledgerline config directory was not found.");
}

export function loadYamlFile(relativePath: string): unknown {
  const path = resolve(resolveConfigDir(), relativePath);
  try {
    return parseYaml(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Ledgerline could not read config/${relativePath}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export function tryLoadYamlFile(relativePath: string): unknown | null {
  const path = resolve(resolveConfigDir(), relativePath);
  if (!existsSync(path)) return null;
  return loadYamlFile(relativePath);
}
