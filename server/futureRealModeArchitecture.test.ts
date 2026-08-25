import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const diagram = readFileSync(fileURLToPath(new URL("../docs/architecture/future-real-mode-architecture.mmd", import.meta.url)), "utf8");
const guide = readFileSync(fileURLToPath(new URL("../docs/architecture/future-real-mode-architecture.md", import.meta.url)), "utf8");

describe("future real-mode architecture documentation", () => {
  it("keeps the active simulation boundary separate from prospective gates and execution controls", () => {
    expect(diagram).toContain("Active Ledgerline · simulation-only");
    expect(diagram).toContain("Current enforced boundary");
    expect(diagram).toContain("Future real-mode activation program");
    expect(diagram).toContain("Future real-mode control plane · not implemented");
    expect(diagram).toContain("Out-of-band kill switch");
    expect(diagram).toContain("No keys · no credentials · no signing · no custody");
  });

  it("documents the architecture as a non-activating design target with a managed rendered asset", () => {
    expect(guide).toContain("prospective architecture only");
    expect(guide).toContain("does **not** enable");
    expect(guide).toContain("/manus-storage/ledgerline-future-real-mode-architecture_d930942a.png");
  });
});
