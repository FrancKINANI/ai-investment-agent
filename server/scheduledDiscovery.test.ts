import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
const fabric = vi.hoisted(() => ({ getDiscoveryScheduleByTaskUid: vi.fn(), listWatchlistItems: vi.fn(), ensureProtectedAgentNodes: vi.fn(), getDiscoveryFindingById: vi.fn(), createDiscoveryFinding: vi.fn(), createEvolutionEvent: vi.fn(), markDiscoveryScheduleRun: vi.fn() }));
const db = vi.hoisted(() => ({ getInvestmentPolicy: vi.fn(), createOperatorAction: vi.fn() }));
const onchain = vi.hoisted(() => ({ getEthereumTokenMetrics: vi.fn() }));

vi.mock("./_core/sdk", () => ({ sdk }));
vi.mock("./agentFabricDb", () => fabric);
vi.mock("./db", () => db);
vi.mock("./onchain", () => onchain);

import { scheduledDiscoveryHandler } from "./scheduledDiscovery";

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
  fabric.getDiscoveryScheduleByTaskUid.mockResolvedValue({ scheduleId: "schedule-1", userId: 7, cadence: "daily", enabled: true });
  fabric.listWatchlistItems.mockResolvedValue([{ itemId: "item-1", label: "TEST", address: "0x0000000000000000000000000000000000000001" }]);
  fabric.ensureProtectedAgentNodes.mockResolvedValue([{ agentId: "core-fundamental", roleKey: "fundamental" }]);
  fabric.getDiscoveryFindingById.mockResolvedValue(null);
  fabric.createDiscoveryFinding.mockResolvedValue({ findingId: "finding-1" });
  fabric.createEvolutionEvent.mockResolvedValue({});
  fabric.markDiscoveryScheduleRun.mockResolvedValue();
  db.getInvestmentPolicy.mockResolvedValue({ allowedAssets: ["0x0000000000000000000000000000000000000001"] });
  db.createOperatorAction.mockResolvedValue({});
  onchain.getEthereumTokenMetrics.mockResolvedValue({ token: { address: "0x0000000000000000000000000000000000000001", symbol: "TEST", holders: 22 }, market: { liquidityUsd: 250000, sourceUrl: "https://dex.example" }, sources: { explorer: "Blockscout public API", market: "DexScreener public API" }, freshness: "live" });
});

describe("scheduled discovery callback", () => {
  it("rejects a request that is not an authenticated scheduler callback", async () => {
    sdk.authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await scheduledDiscoveryHandler({ originalUrl: "/api/scheduled/discovery" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "cron-only" });
  });

  it("writes a source-bound, simulation-only candidate finding and immutable audit event", async () => {
    const res = response();
    await scheduledDiscoveryHandler({ originalUrl: "/api/scheduled/discovery" } as never, res as never);
    expect(fabric.createDiscoveryFinding).toHaveBeenCalledWith(7, expect.objectContaining({ scheduleId: "schedule-1", watchlistItemId: "item-1", status: "candidate", confidence: "high", evidence: expect.arrayContaining(["schedule:simulation-only", "source:Blockscout public API", "source:DexScreener public API"]) }));
    expect(fabric.createEvolutionEvent).toHaveBeenCalledWith(7, expect.objectContaining({ state: "completed" }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "discovery_completed", payload: expect.objectContaining({ execution: "simulation-only" }) }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, findings: 1 }));
  });

  it("does not duplicate a finding when the callback retries the same cadence bucket", async () => {
    fabric.getDiscoveryFindingById.mockResolvedValue({ findingId: "existing" });
    const res = response();
    await scheduledDiscoveryHandler({ originalUrl: "/api/scheduled/discovery" } as never, res as never);
    expect(fabric.createDiscoveryFinding).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, findings: 0 }));
  });
});
