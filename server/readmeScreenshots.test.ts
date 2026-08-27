import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readme = readFileSync(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");

describe("README product screenshots", () => {
  it("uses current managed Command, Settings governance, and Activity assets", () => {
    expect(readme).toContain("Configuration-Driven Control");
    expect(readme).toContain("Fail-Closed Defaults");
    expect(readme).toContain("Decision Journal + Audit Trail");
  });
});
