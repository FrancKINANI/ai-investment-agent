import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  createAgentRun: vi.fn(),
  createAwarenessRecord: vi.fn(),
  createOperatorAction: vi.fn(),
  createOutcomeRecord: vi.fn(),
  createStrategyEvaluation: vi.fn(),
  createStrategyLineage: vi.fn(),
  getInvestmentPolicy: vi.fn(),
  listAgentProfiles: vi.fn(),
  listAgentRuns: vi.fn(),
  listAwarenessRecords: vi.fn(),
  listOperatorActions: vi.fn(),
  listOutcomeRecords: vi.fn(),
  listStrategyEvaluations: vi.fn(),
  listStrategyLineages: vi.fn(),
  saveInvestmentPolicy: vi.fn(),
}));

vi.mock("./db", () => db);
vi.mock("./_core/llm", () => ({ listLLMModels: vi.fn().mockResolvedValue({ data: [] }) }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: { id: 7, openId: "test-owner", name: "Test Owner", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.createAgentRun.mockResolvedValue({ id: 1 });
  db.createAwarenessRecord.mockResolvedValue({ id: 2 });
  db.createOperatorAction.mockResolvedValue({ id: 3 });
  db.createStrategyLineage.mockResolvedValue({ id: 4 });
  db.createStrategyEvaluation.mockResolvedValue({ id: 5 });
  db.createOutcomeRecord.mockResolvedValue({ id: 6 });
  db.listStrategyLineages.mockResolvedValue([{ id: 11, lineageId: "L-1" }]);
  db.listStrategyEvaluations.mockResolvedValue([{ id: 12, lineageId: "L-1", gateResult: "review" }]);
  db.listOutcomeRecords.mockResolvedValue([{ id: 13, lineageId: "L-1", deviation: "underperforming" }]);
});

describe("authenticated persistence contracts", () => {
  it("creates a paper run, operator action, and Action-awareness record together", async () => {
    const caller = appRouter.createCaller(context());
    await caller.history.startSimulation({ policyVersion: 2 });
    expect(db.createAgentRun).toHaveBeenCalledWith(7, expect.objectContaining({ policyResult: "pass", status: "passed" }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "simulation_started", status: "success" }));
    expect(db.createAwarenessRecord).toHaveBeenCalledWith(7, expect.objectContaining({ layer: "action" }));
  });

  it("creates lineage, evaluation, and outcome records with their awareness layers", async () => {
    const caller = appRouter.createCaller(context());
    await caller.audit.createLineage({ lineageId: "L-1", name: "Liquidity thesis", stage: "research", generation: 1, rationale: "Owner-created research lineage." });
    await caller.audit.createEvaluation({ lineageId: "L-1", version: "v1", gateResult: "review", simulationPassed: true, coverage: 80, complexityPenalty: 10, rationale: "Evidence is sufficient for continued paper review." });
    await caller.audit.createOutcome({ lineageId: "L-1", expectedBps: 100, realizedBps: 80, deviation: "underperforming", narrative: "Observed paper result under the declared expectation." });
    expect(db.createStrategyLineage).toHaveBeenCalledWith(7, expect.objectContaining({ lineageId: "L-1", scores: {} }));
    expect(db.createStrategyEvaluation).toHaveBeenCalledWith(7, expect.objectContaining({ gateResult: "review" }));
    expect(db.createOutcomeRecord).toHaveBeenCalledWith(7, expect.objectContaining({ realizedBps: 80 }));
    expect(db.createAwarenessRecord).toHaveBeenCalledWith(7, expect.objectContaining({ layer: "evolutionary" }));
    expect(db.createAwarenessRecord).toHaveBeenCalledWith(7, expect.objectContaining({ layer: "justification" }));
    expect(db.createAwarenessRecord).toHaveBeenCalledWith(7, expect.objectContaining({ layer: "result" }));
  });

  it("returns owner-scoped research records to the protected review queries", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.audit.lineages()).resolves.toEqual([{ id: 11, lineageId: "L-1" }]);
    await expect(caller.audit.evaluations()).resolves.toEqual([{ id: 12, lineageId: "L-1", gateResult: "review" }]);
    await expect(caller.audit.outcomes()).resolves.toEqual([{ id: 13, lineageId: "L-1", deviation: "underperforming" }]);
    expect(db.listStrategyLineages).toHaveBeenCalledWith(7);
    expect(db.listStrategyEvaluations).toHaveBeenCalledWith(7);
    expect(db.listOutcomeRecords).toHaveBeenCalledWith(7);
  });
});
