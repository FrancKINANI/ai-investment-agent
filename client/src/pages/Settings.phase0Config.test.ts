import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const settings = readFileSync(fileURLToPath(new URL("./Settings.tsx", import.meta.url)), "utf8");

describe("Settings Phase 0 configuration surface", () => {
  it("renders the validated YAML contract as inspection-only with disabled MCP declarations", () => {
    expect(settings).toContain("phase0Configuration");
    expect(settings).toContain("YAML configuration contract");
    expect(settings).toContain("runtime configuration cannot be changed here");
    expect(settings).toContain("No secrets or connection targets");
  });
});
