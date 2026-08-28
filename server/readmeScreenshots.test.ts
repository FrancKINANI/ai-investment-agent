import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readme = readFileSync(fileURLToPath(new URL("../README.md", import.meta.url)), "utf8");

describe("README product positioning", () => {
  it("describes the current Mission Control and scoped-memory product without claiming live execution", () => {
    expect(readme).toContain("Mission Control");
    expect(readme).toContain("Shared and private memory");
    expect(readme).toContain("Real-capital status: NO-GO");
    expect(readme).not.toContain("supports real execution");
    expect(readme).not.toContain("Binance live trading");
  });
});
