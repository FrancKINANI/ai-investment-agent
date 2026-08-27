import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const missionControl = readFileSync(fileURLToPath(new URL("./MissionControl.tsx", import.meta.url)), "utf8");
const tasks = readFileSync(fileURLToPath(new URL("./Tasks.tsx", import.meta.url)), "utf8");
const decisions = readFileSync(fileURLToPath(new URL("./DecisionDesk.tsx", import.meta.url)), "utf8");
const portfolio = readFileSync(fileURLToPath(new URL("./Portfolio.tsx", import.meta.url)), "utf8");
const newWorkspaceSource = [missionControl, tasks, decisions, portfolio].join("\n");

describe("Mission Control safety presentation", () => {
  it("makes the sealed execution boundary visible without importing a venue mutation path", () => {
    expect(missionControl).toContain("Simulation · sealed");
    expect(missionControl).toContain("Venue mutations remain unavailable.");
    expect(decisions).toContain("The real-capital execution path remains sealed.");
    expect(portfolio).toContain("never invents a balance or implies trade authority");
    expect(newWorkspaceSource).not.toMatch(/placeOrder|cancelOrder|executeLiveOrder|cancelLiveOrder|BinanceRestClient/);
  });
});
