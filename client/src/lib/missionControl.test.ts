import { describe, expect, it } from "vitest";
import { getAgentMissionState, latestAgentEvent, taskBucket } from "./missionControl";

describe("mission-control presentation helpers", () => {
  const events = [
    { agentId: "fundamental", createdAt: "2026-08-27T10:00:00.000Z", state: "completed" as const, summary: "Completed initial note." },
    { agentId: "fundamental", createdAt: "2026-08-27T10:02:00.000Z", state: "working" as const, summary: "Checking source freshness." },
    { agentId: "risk", createdAt: "2026-08-27T10:03:00.000Z", state: "blocked" as const, summary: "No active IPS." },
  ];

  it("uses the newest active event for an agent instead of treating a completed event as active work", () => {
    expect(latestAgentEvent("fundamental", events)).toMatchObject({ state: "working", summary: "Checking source freshness." });
    expect(getAgentMissionState("fundamental", events)).toMatchObject({ label: "working" });
  });

  it("makes blocked and idle states explicit", () => {
    expect(getAgentMissionState("risk", events)).toMatchObject({ label: "blocked", summary: "No active IPS." });
    expect(getAgentMissionState("news", events)).toMatchObject({ label: "ready" });
  });

  it("groups the durable task lifecycle without inferring a completed outcome", () => {
    expect(taskBucket("delegated")).toBe("now");
    expect(taskBucket("working")).toBe("now");
    expect(taskBucket("blocked")).toBe("blocked");
    expect(taskBucket("completed")).toBe("completed");
  });
});
