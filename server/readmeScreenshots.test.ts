import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readme = readFileSync(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");

describe("README product screenshots", () => {
  it("uses current managed Command, Settings governance, and Activity assets", () => {
    expect(readme).toContain("/manus-storage/ledgerline-command-current_73c0a7af.png");
    expect(readme).toContain("/manus-storage/ledgerline-settings-governance-current_bc79ea06.png");
    expect(readme).toContain("/manus-storage/ledgerline-activity-current_d578a200.png");
    expect(readme).toContain("Settings and governance");
    expect(readme).toContain("Immutable activity");
  });
});
