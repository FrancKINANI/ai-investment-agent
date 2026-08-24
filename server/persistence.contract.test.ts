import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  createAgentRun: vi.fn(),
  createAgentProposal: vi.fn(),
  createAwarenessRecord: vi.fn(),
  createOperatorAction: vi.fn(),
  createOutcomeRecord: vi.fn(),
  createStrategyEvaluation: vi.fn(),
  createStrategyLineage: vi.fn(),
  createVenueConnection: vi.fn(),
  createWalletMandate: vi.fn(),
  getAgentProposal: vi.fn(),
  getInvestmentPolicy: vi.fn(),
  listAgentProfiles: vi.fn(),
  listAgentProposals: vi.fn(),
  listAgentRuns: vi.fn(),
  listAwarenessRecords: vi.fn(),
  listOperatorActions: vi.fn(),
  listOutcomeRecords: vi.fn(),
  listStrategyEvaluations: vi.fn(),
  listStrategyLineages: vi.fn(),
  listVenueConnections: vi.fn(),
  listWalletMandates: vi.fn(),
  saveInvestmentPolicy: vi.fn(),
  updateAgentProposalStatus: vi.fn(),
  updateWalletMandateMode: vi.fn(),
}));
const research = vi.hoisted(() => ({ runTokenResearch: vi.fn() }));

vi.mock("./db", () => db);
vi.mock("./research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./research")>();
  return { ...actual, runTokenResearch: research.runTokenResearch };
});
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
  db.createAgentProposal.mockResolvedValue({ id: 7, proposalId: "proposal-1" });
  db.createAwarenessRecord.mockResolvedValue({ id: 2 });
  db.createOperatorAction.mockResolvedValue({ id: 3 });
  db.createStrategyLineage.mockResolvedValue({ id: 4 });
  db.createStrategyEvaluation.mockResolvedValue({ id: 5 });
  db.createOutcomeRecord.mockResolvedValue({ id: 6 });
  db.createVenueConnection.mockResolvedValue({ id: 8, connectionId: "connection-1" });
  db.createWalletMandate.mockResolvedValue({ id: 9, mandateId: "mandate-1" });
  db.getInvestmentPolicy.mockResolvedValue(null);
  db.listStrategyLineages.mockResolvedValue([{ id: 11, lineageId: "L-1" }]);
  db.listStrategyEvaluations.mockResolvedValue([{ id: 12, lineageId: "L-1", gateResult: "review" }]);
  db.listOutcomeRecords.mockResolvedValue([{ id: 13, lineageId: "L-1", deviation: "underperforming" }]);
  db.listAgentProposals.mockResolvedValue([]);
  db.listVenueConnections.mockResolvedValue([]);
  db.listWalletMandates.mockResolvedValue([]);
  db.updateAgentProposalStatus.mockResolvedValue({ id: 7, proposalId: "proposal-1", status: "approved" });
  db.updateWalletMandateMode.mockResolvedValue({ id: 9, mandateId: "mandate-1", walletRole: "trading", venue: "binance", mode: "paused" });
  research.runTokenResearch.mockResolvedValue({
    report: { headline: "Evidence supports paper review", thesis: "The structured packet supports a limited simulation review.", researchNextStep: "Check source continuity before any paper test." },
    policy: { result: "pass", reasons: ["The contract is approved by the owner IPS."] },
    advancement: { status: "allowed", reason: "The proposal may enter owner simulation review." },
    evidence: { asset: { address: "0x0000000000000000000000000000000000000001", symbol: "TEST" }, provenance: { sources: { explorer: "Blockscout", market: "DexScreener" }, freshness: "live" } },
  });
});

describe("authenticated persistence contracts", () => {
  it("returns null, not undefined, when an authenticated owner has no saved IPS", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.policy.current()).resolves.toBeNull();
    expect(db.getInvestmentPolicy).toHaveBeenCalledWith(7);
  });

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

  it("creates owner-scoped simulation mandates and venue adapters while preserving disconnected real execution", async () => {
    const caller = appRouter.createCaller(context());
    await caller.autonomy.createSimulationMandate({ walletRole: "trading", venue: "binance", allowedAssets: ["BTCUSDT"], maxOrderBps: 250, dailyCapBps: 700 });
    await caller.autonomy.createSimulationConnection({ venue: "binance", capabilities: ["market.read", "account.read", "trade.future"] });
    expect(db.createWalletMandate).toHaveBeenCalledWith(7, expect.objectContaining({ walletRole: "trading", venue: "binance", mode: "simulation", status: "active" }));
    expect(db.createVenueConnection).toHaveBeenCalledWith(7, expect.objectContaining({ venue: "binance", state: "simulation" }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "mandate_created" }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "venue_configured" }));
    await expect(caller.autonomy.setMandateMode({ mandateId: "mandate-1", mode: "real" })).rejects.toThrow("Real mode is not available");
  });

  it("records the owner decision through approval, rejection, and simulated settlement lifecycle events", async () => {
    const caller = appRouter.createCaller(context());
    const reviewProposal = { proposalId: "proposal-1", status: "review", policyResult: "pass", title: "ETH evidence review", venue: "evm", walletRole: "trading", runId: "run-1" };
    db.getAgentProposal.mockResolvedValueOnce(reviewProposal).mockResolvedValueOnce({ ...reviewProposal, status: "approved" }).mockResolvedValueOnce(reviewProposal);
    await caller.autonomy.approveProposal({ proposalId: "proposal-1" });
    await caller.autonomy.settleSimulation({ proposalId: "proposal-1" });
    await caller.autonomy.rejectProposal({ proposalId: "proposal-1", reason: "Owner wants more evidence before a paper test." });
    expect(db.updateAgentProposalStatus).toHaveBeenCalledWith(7, "proposal-1", "approved");
    expect(db.updateAgentProposalStatus).toHaveBeenCalledWith(7, "proposal-1", "simulated");
    expect(db.updateAgentProposalStatus).toHaveBeenCalledWith(7, "proposal-1", "rejected");
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "proposal_approved" }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "simulation_settled" }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "proposal_rejected" }));
    expect(db.createAwarenessRecord).toHaveBeenCalledWith(7, expect.objectContaining({ layer: "result", subject: expect.stringContaining("Simulation settled") }));
  });

  it("creates a persisted paper proposal and proposal-created audit event from the research agent path", async () => {
    const caller = appRouter.createCaller(context());
    db.getInvestmentPolicy.mockResolvedValue({ name: "Owner IPS", version: 3, allowedAssets: ["0x0000000000000000000000000000000000000001"] });
    await caller.research.analyzeToken({ address: "0x0000000000000000000000000000000000000001", question: "Assess this candidate for a policy-bound paper proposal." });
    expect(db.createAgentProposal).toHaveBeenCalledWith(7, expect.objectContaining({ walletRole: "trading", venue: "evm", status: "review", policyResult: "pass", title: "Evidence supports paper review" }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(7, expect.objectContaining({ kind: "proposal_created", status: "review", subject: "Paper proposal: TEST" }));
  });

  it("records the ordered lifecycle from research proposal to approval and simulated settlement", async () => {
    const caller = appRouter.createCaller(context());
    const reviewProposal = { proposalId: "proposal-1", status: "review", policyResult: "pass", title: "Evidence supports paper review", venue: "evm", walletRole: "trading", runId: "run-1" };
    db.getInvestmentPolicy.mockResolvedValue({ name: "Owner IPS", version: 3, allowedAssets: ["0x0000000000000000000000000000000000000001"] });
    db.getAgentProposal.mockResolvedValueOnce(reviewProposal).mockResolvedValueOnce({ ...reviewProposal, status: "approved" });
    await caller.research.analyzeToken({ address: "0x0000000000000000000000000000000000000001", question: "Run the complete paper lifecycle." });
    await caller.autonomy.approveProposal({ proposalId: "proposal-1" });
    await caller.autonomy.settleSimulation({ proposalId: "proposal-1" });
    const lifecycleKinds = db.createOperatorAction.mock.calls.map(([, action]) => action.kind);
    expect(lifecycleKinds).toEqual(expect.arrayContaining(["research_completed", "proposal_created", "proposal_approved", "simulation_settled"]));
    expect(lifecycleKinds.indexOf("proposal_created")).toBeLessThan(lifecycleKinds.indexOf("proposal_approved"));
    expect(lifecycleKinds.indexOf("proposal_approved")).toBeLessThan(lifecycleKinds.indexOf("simulation_settled"));
  });

  it("records the ordered rejection branch and prevents settlement after owner rejection", async () => {
    const caller = appRouter.createCaller(context());
    const reviewProposal = { proposalId: "proposal-1", status: "review", policyResult: "pass", title: "Evidence supports paper review", venue: "evm", walletRole: "trading", runId: "run-1" };
    db.getInvestmentPolicy.mockResolvedValue({ name: "Owner IPS", version: 3, allowedAssets: ["0x0000000000000000000000000000000000000001"] });
    db.getAgentProposal.mockResolvedValueOnce(reviewProposal).mockResolvedValueOnce({ ...reviewProposal, status: "rejected" });
    await caller.research.analyzeToken({ address: "0x0000000000000000000000000000000000000001", question: "Reject this proposal after the research cycle." });
    await caller.autonomy.rejectProposal({ proposalId: "proposal-1", reason: "The owner requires additional protocol diligence." });
    await expect(caller.autonomy.settleSimulation({ proposalId: "proposal-1" })).rejects.toThrow("Only an owner-approved proposal can be settled");
    const lifecycleKinds = db.createOperatorAction.mock.calls.map(([, action]) => action.kind);
    expect(lifecycleKinds.indexOf("proposal_created")).toBeLessThan(lifecycleKinds.indexOf("proposal_rejected"));
    expect(lifecycleKinds).not.toContain("simulation_settled");
    expect(db.updateAgentProposalStatus).toHaveBeenCalledWith(7, "proposal-1", "rejected");
  });
});
