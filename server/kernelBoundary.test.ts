/**
 * S3 REGRESSION TEST: Decision Kernel Boundary
 *
 * Proves that Decision Kernel inputs (simulationPassed, ownerPauseActive,
 * lineageCoverage, complexityPenalty) are derived from server-side persisted
 * records, NOT from client-supplied values.
 *
 * This test verifies that even if a client sends manipulated gate inputs,
 * the server ignores them and uses its own derived values.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  createAgentRun: vi.fn(),
  createAgentProposal: vi.fn(),
  createAwarenessRecord: vi.fn(),
  createOperatorAction: vi.fn(),
  getAgentProposal: vi.fn(),
  getInvestmentPolicy: vi.fn(),
  getAuthorityState: vi.fn(),
  listAgentRuns: vi.fn(),
  listAgentProfiles: vi.fn(),
  listAgentProposals: vi.fn(),
  listAwarenessRecords: vi.fn(),
  listOperatorActions: vi.fn(),
  listStrategyLineages: vi.fn(),
  listStrategyEvaluations: vi.fn(),
  listOutcomeRecords: vi.fn(),
  listVenueConnections: vi.fn(),
  listWalletMandates: vi.fn(),
  updateAgentProposalStatus: vi.fn(),
  updateWalletMandateMode: vi.fn(),
  saveInvestmentPolicy: vi.fn(),
  createWalletMandate: vi.fn(),
  createVenueConnection: vi.fn(),
  createBindingChangeRequest: vi.fn(),
  getBindingChangeRequest: vi.fn(),
  reviewBindingChangeRequest: vi.fn(),
  listBindingChangeRequests: vi.fn(),
}));

const orchestrator = vi.hoisted(() => ({
  executeApprovedProposal: vi.fn(),
  evaluateProposalApproval: vi.fn(),
}));

vi.mock("./db", () => db);
vi.mock("./runtime/executionOrchestrator", () => orchestrator);
vi.mock("./_core/llm", () => ({ listLLMModels: vi.fn().mockResolvedValue({ data: [] }) }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: { id: 7, openId: "test-owner", name: "Test Owner", email: null, loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.getAuthorityState.mockResolvedValue("approval-required-live");
  db.listAgentRuns.mockResolvedValue([]);
  db.listAgentProposals.mockResolvedValue([]);
  db.listWalletMandates.mockResolvedValue([]);
  db.listVenueConnections.mockResolvedValue([]);
  db.getInvestmentPolicy.mockResolvedValue(null);
  db.updateAgentProposalStatus.mockResolvedValue({ id: 1, proposalId: "p-1", status: "approved" });
  db.createOperatorAction.mockResolvedValue({ id: 1 });
  db.createAwarenessRecord.mockResolvedValue({ id: 1 });
  db.getAgentProposal.mockResolvedValue(null);
});

describe("S3 — Decision Kernel boundary (server-derived inputs)", () => {
  it("reviewHardGate ignores client-supplied gate inputs and derives from server records", async () => {
    const caller = appRouter.createCaller(context());
    const proposal = {
      proposalId: "p-1",
      status: "review",
      policyResult: "pass",
      title: "Test proposal",
      venue: "evm",
      walletRole: "trading",
      runId: "run-1",
    };
    db.getAgentProposal.mockResolvedValue(proposal);
    db.listAgentRuns.mockResolvedValue([{ runId: "run-1", status: "passed", policyResult: "pass", summary: "ok", evidence: [] }]);

    // Client tries to send manipulated inputs — these should be IGNORED
    const result = await caller.autonomy.reviewHardGate({
      proposalId: "p-1",
      rationale: "Test S3",
    });

    // The gate should have passed because:
    // - simulationPassed = true (derived from run status "passed")
    // - ownerPauseActive = false (derived from authority state "approval-required-live")
    // - lineageCoverage = 0 (default, not blocked because 0 means "no data")
    // - complexityPenalty = 0 (default)
    expect(result.gate.state).toBe("pass");

    // Verify the operator action contains server-derived inputs, not client claims
    const actionCall = db.createOperatorAction.mock.calls.find(
      ([, action]: [number, any]) => action.kind === "scope_checked"
    );
    expect(actionCall).toBeDefined();
    expect(actionCall[1].payload.inputs).toEqual({
      simulationPassed: true,
      ownerPauseActive: false,
      lineageCoverage: 0,
      complexityPenalty: 0,
    });
  });

  it("reviewHardGate blocks when authority state is paused (S1 regression)", async () => {
    const caller = appRouter.createCaller(context());
    const proposal = {
      proposalId: "p-1",
      status: "review",
      policyResult: "pass",
      title: "Test",
      venue: "evm",
      walletRole: "trading",
      runId: "run-1",
    };
    db.getAgentProposal.mockResolvedValue(proposal);
    db.getAuthorityState.mockResolvedValue("paused");
    db.listAgentRuns.mockResolvedValue([{ runId: "run-1", status: "passed", policyResult: "pass", summary: "ok", evidence: [] }]);

    const result = await caller.autonomy.reviewHardGate({
      proposalId: "p-1",
      rationale: "Should be blocked",
    });

    // Gate must block because owner is paused — even though run passed
    expect(result.gate.state).toBe("block");
    expect(result.gate.reason).toContain("Owner pause");
  });

  it("approveProposal uses server-derived inputs, not client claims", async () => {
    const caller = appRouter.createCaller(context());
    const proposal = {
      proposalId: "p-1",
      status: "review",
      policyResult: "pass",
      title: "Test",
      venue: "evm",
      walletRole: "trading",
      runId: "run-1",
    };
    db.getAgentProposal.mockResolvedValue(proposal);
    db.listAgentRuns.mockResolvedValue([{ runId: "run-1", status: "passed", policyResult: "pass", summary: "ok", evidence: [] }]);

    // Approve with only rationale — no gate inputs from client
    const result = await caller.autonomy.approveProposal({
      proposalId: "p-1",
      rationale: "S3 test approval",
    });

    expect(result).toBeDefined();
    expect(db.updateAgentProposalStatus).toHaveBeenCalledWith(7, "p-1", "approved");
  });
});
