import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = fileURLToPath(new URL("../scripts/ledgerline.mjs", import.meta.url));

function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
}

describe("ledgerline Phase 0 CLI", () => {
  it("validates configuration and reports the no-active-MCP, simulation-only contract", () => {
    const result = run("config", "validate");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ valid: true, executionBoundary: "simulation-only", activeMcpServers: 0 });
  });

  it("lists declarative disabled MCP entries but refuses mutation or activation verbs", () => {
    const listed = run("mcp", "list");
    const refused = run("mcp", "enable", "sailor");
    expect(listed.status).toBe(0);
    expect(JSON.parse(listed.stdout)).toEqual(expect.arrayContaining([expect.objectContaining({ id: "sailor", state: "disabled", registration: "declarative-only" })]));
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain("inspection-only commands");
  });
});
