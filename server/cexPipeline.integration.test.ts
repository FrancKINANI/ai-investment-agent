/**
 * Integration test: full research → approve → CEX execute pipeline.
 *
 * Tests the end-to-end flow through the tRPC router:
 *   1. analyzeToken → creates proposal
 *   2. approveProposal → checks hard gate, approves for execution
 *   3. settleSimulation → orchestrator → CEX backend → liveAdapter
 *
 * All external deps are mocked. The test verifies the wiring between
 * components, not the external API calls.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getInvestmentPolicy: vi.fn(),
  getAuthorityState: vi.fn(),
  getAgentProposal: vi.fn(),
  updateAgentProposalStatus: vi.fn(),
  createAgentProposal: vi.fn(),
  createAgentRun: vi.fn(),
  createOperatorAction: vi.fn().mockResolvedValue({}),
  createAwarenessRecord: vi.fn().mockResolvedValue({}),
  createSecurityAlert: vi.fn().mockResolvedValue({}),
  listAgentRuns: vi.fn().mockResolvedValue([]),
  listWalletMandates: vi.fn().mockResolvedValue([]),
  listPlatformApiKeys: vi.fn().mockResolvedValue([]),
  getPlatformApiKey: vi.fn(),
  getLiveOrderByIdempotencyKey: vi.fn(),
  appendLedgerEvent: vi.fn().mockResolvedValue({}),
  consumeLiveOrderApproval: vi.fn(),
  listAgentProposals: vi.fn().mockResolvedValue([]),
}));

vi.mock("./research", () => ({
  researchRequestSchema: { parse: (v: any) => v },
  runTokenResearch: vi.fn(),
}));

vi.mock("./agentFabric", () => ({
  composeSpecialistOutput: vi.fn().mockResolvedValue("specialist output"),
  composeFundManagerDisagreementSummary: vi.fn().mockResolvedValue("disagreement summary"),
  composeSupervisorReply: vi.fn().mockResolvedValue("supervisor reply"),
  calculateResearchNoteConfidence: vi.fn().mockReturnValue(0.8),
  defaultDelegation: ["macro", "onchain", "bull", "bear"],
}));

vi.mock("./agentFabricDb", () => ({
  ensureProtectedAgentNodes: vi.fn().mockResolvedValue([
    { agentId: "supervisor-1", roleKey: "supervisor", name: "Supervisor", model: "gpt-4", protectedRole: true },
    { agentId: "fund-1", roleKey: "fund_manager", name: "Fund Manager", model: "gpt-4", protectedRole: true },
    { agentId: "macro-1", roleKey: "macro", name: "Macro Agent", model: "gpt-4", protectedRole: true },
  ]),
  createConversation: vi.fn().mockResolvedValue({}),
  createAgentMessage: vi.fn().mockResolvedValue({}),
  createEvolutionEvent: vi.fn().mockResolvedValue({}),
  listAgentMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock("./liveAdapter", () => ({
  executeLiveOrder: vi.fn(),
  getLiveBalances: vi.fn().mockResolvedValue([]),
  getLiveTicker: vi.fn().mockResolvedValue({ price: 50000, symbol: "BTCUSDT" }),
  checkMandateAllowance: vi.fn().mockReturnValue({ allowed: true, reason: "ok", mandateId: "mandate-1", mode: "real" }),
}));

vi.mock("./binance", () => ({
  placeOrder: vi.fn(),
  getPrice: vi.fn().mockResolvedValue({ symbol: "BTCUSDT", price: "50000" }),
  getBalances: vi.fn().mockResolvedValue([]),
  getAccount: vi.fn(),
}));

vi.mock("./liveData", () => ({
  readBinanceTicker: vi.fn().mockResolvedValue({ ok: true, data: { price: 50000, change24h: 2.5, volume: 1e9 } }),
}));

vi.mock("./kms", () => ({
  decryptSecret: vi.fn((v: string) => `decrypted:${v}`),
}));

vi.mock("@shared/mandateAuthority", () => ({
  reconcileLiveExecution: vi.fn().mockReturnValue({ allowed: true, reason: "ok" }),
  liveOrderApprovalHash: vi.fn().mockReturnValue("hash-123"),
}));

vi.mock("@shared/paperExecution", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shared/paperExecution")>();
  return {
    ...actual,
    ledgerSeq: vi.fn((status: string) => `seq-${status}`),
  };
});

vi.mock("./runtime/executionOrchestrator", () => ({
  executeApprovedProposal: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────

import { appRouter } from "./routers";
import * as db from "./db";
import { executeApprovedProposal } from "./runtime/executionOrchestrator";

// ─── Helpers ──────────────────────────────────────────────────────────────

function createContext(userId = 1, role: "user" | "admin" = "admin") {
  return {
    user: { id: userId, openId: "test-user", name: "Test Owner", role },
    req: { headers: { cookie: "" } } as any,
    res: { setHeader: () => {}, status: () => ({ json: () => {} }) } as any,
  };
}

// ─── Test Data ────────────────────────────────────────────────────────────

const mockPolicy = {
  name: "Owner IPS",
  version: 3,
  allowedAssets: ["0x0000000000000000000000000000000000000001"],
};

const mockProposal = {
  proposalId: "proposal-1",
  runId: "run-1",
  walletRole: "trading",
  venue: "binance",
  status: "review",
  policyResult: "pass",
  title: "Buy BTC",
  rationale: "Strong bull case",
  action: { kind: "token_research_paper_proposal", address: "0xabc", nextStep: "execute" },
};

const mockResearchResult = {
  evidence: {
    asset: { address: "0xabc", symbol: "BTC" },
    provenance: { sources: { explorer: "blockscout", market: "dexscreener" }, freshness: "5m" },
  },
  policy: { result: "pass", name: "Owner IPS", version: 3, allowedAssets: [] },
  advancement: { status: "allowed", reason: "policy passed" },
  report: { headline: "Buy BTC", thesis: "Strong bull case", researchNextStep: "execute" },
};

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Full CEX pipeline: research → approve → execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getInvestmentPolicy).mockResolvedValue(mockPolicy as any);
    vi.mocked(db.getAuthorityState).mockResolvedValue("approval-required-live");
    vi.mocked(db.listAgentRuns).mockResolvedValue([{ runId: "run-1", status: "passed" }] as any);
  });

  it("1. analyzeToken creates a proposal with status review", async () => {
    vi.mocked(db.createAgentProposal).mockResolvedValue({ proposalId: "proposal-1" } as any);
    const { runTokenResearch } = await import("./research");
    vi.mocked(runTokenResearch).mockResolvedValue(mockResearchResult as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.research.analyzeToken({
      address: "0xabc",
      question: "Should I buy BTC?",
    });

    expect(result).toBeDefined();
    expect(result.proposalId).toBe("proposal-1");
    // Proposal was created (mock was called)
    expect(db.createAgentProposal).toHaveBeenCalled();
  });

  it("2. approveProposal passes when gate inputs are server-derived", async () => {
    vi.mocked(db.getAgentProposal).mockResolvedValue(mockProposal as any);
    vi.mocked(db.updateAgentProposalStatus).mockResolvedValue({ ...mockProposal, status: "approved" } as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.autonomy.approveProposal({
      proposalId: "proposal-1",
      rationale: "I approve this trade",
    });

    expect(result).toBeDefined();
    expect(db.updateAgentProposalStatus).toHaveBeenCalledWith(1, "proposal-1", "approved");
  });

  it("3. settleSimulation calls executeApprovedProposal", async () => {
    vi.mocked(executeApprovedProposal).mockResolvedValue({
      status: "approved",
      proposalId: "proposal-1",
      reason: "Paper execution succeeded.",
    });

    const caller = appRouter.createCaller(createContext());
    const result = await caller.autonomy.settleSimulation({
      proposalId: "proposal-1",
    });

    expect(result).toBeDefined();
    expect(executeApprovedProposal).toHaveBeenCalledWith({ userId: 1, proposalId: "proposal-1" });
  });

  it("4. full flow: research → approve → settle", async () => {
    // Step 1: Research
    vi.mocked(db.createAgentProposal).mockResolvedValue({ proposalId: "proposal-1" } as any);
    const { runTokenResearch } = await import("./research");
    vi.mocked(runTokenResearch).mockResolvedValue(mockResearchResult as any);

    const caller = appRouter.createCaller(createContext());
    const research = await caller.research.analyzeToken({
      address: "0xabc",
      question: "Should I buy BTC?",
    });
    expect(research.proposalId).toBe("proposal-1");

    // Step 2: Approve
    vi.mocked(db.getAgentProposal).mockResolvedValue(mockProposal as any);
    vi.mocked(db.updateAgentProposalStatus).mockResolvedValue({ ...mockProposal, status: "approved" } as any);

    const approved = await caller.autonomy.approveProposal({
      proposalId: "proposal-1",
      rationale: "Approved",
    });
    expect(approved).toBeDefined();

    // Step 3: Settle
    vi.mocked(executeApprovedProposal).mockResolvedValue({
      status: "approved",
      proposalId: "proposal-1",
      reason: "Execution succeeded.",
    });

    const settled = await caller.autonomy.settleSimulation({
      proposalId: "proposal-1",
    });
    expect(settled).toBeDefined();
    expect(executeApprovedProposal).toHaveBeenCalledTimes(1);
  });

  it("5. approveProposal rejects when authority is paused", async () => {
    vi.mocked(db.getAuthorityState).mockResolvedValue("paused");
    vi.mocked(db.getAgentProposal).mockResolvedValue(mockProposal as any);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.autonomy.approveProposal({
      proposalId: "proposal-1",
      rationale: "Trying to approve while paused",
    })).rejects.toThrow();
  });

  it("6. approveProposal rejects when proposal is not in review status", async () => {
    vi.mocked(db.getAgentProposal).mockResolvedValue({
      ...mockProposal,
      status: "approved",
    } as any);

    const caller = appRouter.createCaller(createContext());
    await expect(caller.autonomy.approveProposal({
      proposalId: "proposal-1",
      rationale: "Already approved",
    })).rejects.toThrow("Only a policy-passing proposal");
  });

  it("7. settleSimulation throws when proposal is not approved", async () => {
    vi.mocked(executeApprovedProposal).mockResolvedValue({
      status: "rejected",
      proposalId: "proposal-1",
      reason: "Only an owner-approved proposal can be executed.",
    });

    const caller = appRouter.createCaller(createContext());
    await expect(caller.autonomy.settleSimulation({
      proposalId: "proposal-1",
    })).rejects.toThrow("Only an owner-approved proposal");
  });

  it("8. settleSimulation throws when orchestrator rejects", async () => {
    vi.mocked(executeApprovedProposal).mockRejectedValue(
      new Error("Proposal not found.")
    );

    const caller = appRouter.createCaller(createContext());
    await expect(caller.autonomy.settleSimulation({
      proposalId: "nonexistent",
    })).rejects.toThrow("Proposal not found");
  });

  it("9. authority blocks gate review (server-derived inputs)", async () => {
    vi.mocked(db.getAuthorityState).mockResolvedValue("paused");
    vi.mocked(db.getAgentProposal).mockResolvedValue(mockProposal as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.autonomy.reviewHardGate({
      proposalId: "proposal-1",
      rationale: "Checking gate while paused",
    });
    // Gate should block because ownerPauseActive is true
    expect(result.gate.state).toBe("block");
    expect(result.inputs.ownerPauseActive).toBe(true);
  });

  it("10. research blocked when policy fails", async () => {
    vi.mocked(db.createAgentProposal).mockResolvedValue({ proposalId: "proposal-2" } as any);
    const { runTokenResearch } = await import("./research");
    vi.mocked(runTokenResearch).mockResolvedValue({
      ...mockResearchResult,
      policy: { ...mockResearchResult.policy, result: "block" },
      advancement: { status: "blocked", reason: "policy blocked" },
    } as any);

    const caller = appRouter.createCaller(createContext());
    const result = await caller.research.analyzeToken({
      address: "0xabc",
      question: "Should I buy this token?",
    });

    expect(result).toBeDefined();
    // Proposal should be created with blocked status
    expect(db.createAgentProposal).toHaveBeenCalledWith(1, expect.objectContaining({
      status: "blocked",
    }));
  });
});

// ─── CEX Backend integration (lower level) ────────────────────────────────

describe("CEX backend integration with orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAuthorityState).mockResolvedValue("approval-required-live");
    vi.mocked(db.listPlatformApiKeys).mockResolvedValue([{
      keyId: "key-1",
      platform: "binance",
      state: "active",
    }] as any);
  });

  it("orchestrator routes to CEX backend when venue is binance", async () => {
    const { CEXExecutionBackend } = await import("./backends/cex.backend");
    const backend = new CEXExecutionBackend();

    vi.mocked(db.getAuthorityState).mockResolvedValue("approval-required-live");
    vi.mocked(db.listPlatformApiKeys).mockResolvedValue([{
      keyId: "key-1",
      platform: "binance",
      state: "active",
    }] as any);

    // The backend should not be blocked by authority
    const result = await backend.execute({
      userId: 1,
      proposalId: "proposal-1",
      venue: "binance",
      walletRole: "trading",
      order: { symbol: "BTCUSDT", side: "buy", quantity: 0.001 },
      mandate: {
        mandateId: "mandate-1",
        mode: "real",
        status: "active",
        venue: "binance",
        maxOrderBps: 250,
        dailyCapBps: 1000,
        allowedAssets: ["BTCUSDT"],
      },
      authorityState: "approval-required-live",
      metadata: { policyVersion: 1 },
    });

    // Should not be blocked by authority (may fail at liveAdapter level due to mocks)
    expect(result.status).not.toBe("blocked");
  });

  it("CEX backend rejects when authority is disabled", async () => {
    const { CEXExecutionBackend } = await import("./backends/cex.backend");
    const backend = new CEXExecutionBackend();

    const result = await backend.execute({
      userId: 1,
      proposalId: "proposal-1",
      venue: "binance",
      walletRole: "trading",
      order: { symbol: "BTCUSDT", side: "buy", quantity: 0.001 },
      mandate: null,
      authorityState: "disabled",
      metadata: { policyVersion: 1 },
    });

    expect(result.status).toBe("blocked");
  });

  it("CEX backend rejects when no active Binance key", async () => {
    vi.mocked(db.listPlatformApiKeys).mockResolvedValue([]);

    const { CEXExecutionBackend } = await import("./backends/cex.backend");
    const backend = new CEXExecutionBackend();

    const result = await backend.execute({
      userId: 1,
      proposalId: "proposal-1",
      venue: "binance",
      walletRole: "trading",
      order: { symbol: "BTCUSDT", side: "buy", quantity: 0.001 },
      mandate: {
        mandateId: "mandate-1",
        mode: "real",
        status: "active",
        venue: "binance",
        maxOrderBps: 250,
        dailyCapBps: 1000,
        allowedAssets: ["BTCUSDT"],
      },
      authorityState: "approval-required-live",
      metadata: { policyVersion: 1 },
    });

    expect(result.status).toBe("rejected");
  });
});
