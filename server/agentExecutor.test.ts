import { describe, expect, it } from "vitest";
import { executeCexOrder, executeOnChainTx, executeAgentProposal, type AgentProposal } from "./agentExecutor";

// Mock the dependencies
vi.mock("./db", () => ({
  listWalletMandates: vi.fn().mockResolvedValue([]),
  getPlatformApiKey: vi.fn().mockResolvedValue(null),
  createOperatorAction: vi.fn().mockResolvedValue({ id: 1 }),
  createSecurityAlert: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("./liveAdapter", () => ({
  executeLiveOrder: vi.fn().mockRejectedValue(new Error("No DB")),
  getLiveBalances: vi.fn().mockRejectedValue(new Error("No DB")),
  getLiveTicker: vi.fn().mockRejectedValue(new Error("No DB")),
}));

vi.mock("./sailorService", () => ({
  listMandates: vi.fn().mockReturnValue([]),
  executeMandateTransaction: vi.fn().mockRejectedValue(new Error("No DB")),
  getMandate: vi.fn().mockReturnValue(undefined),
}));

import { vi, beforeEach } from "vitest";

const baseProposal: AgentProposal = {
  proposalId: "prop-1",
  title: "Buy BTC",
  rationale: "Bull case strong",
  action: { kind: "token_swap", symbol: "BTCUSDT", side: "BUY", type: "MARKET", quoteOrderQty: 100 },
  venue: "binance",
  walletRole: "trading",
  status: "approved",
};

describe("agent execution pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks CEX order when no mandate exists", async () => {
    const result = await executeCexOrder(1, baseProposal);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No active Binance mandate");
  });

  it("blocks on-chain tx when no Sailor mandate exists", async () => {
    const result = await executeOnChainTx(1, { ...baseProposal, venue: "evm" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("No active Sailor mandate");
  });

  it("routes CEX proposals to CEX executor", async () => {
    const result = await executeAgentProposal(1, baseProposal);
    expect(result.type).toBe("cex");
    expect(result.success).toBe(false); // No mandate
  });

  it("routes on-chain proposals to on-chain executor", async () => {
    const result = await executeAgentProposal(1, { ...baseProposal, venue: "evm" });
    expect(result.type).toBe("on-chain");
    expect(result.success).toBe(false); // No mandate
  });

  it("rejects unknown venues", async () => {
    const result = await executeAgentProposal(1, { ...baseProposal, venue: "unknown" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown venue");
  });
});

describe("agent executor safety contracts", () => {
  it("every execution attempt is logged to the activity record", async () => {
    const { createOperatorAction } = await import("./db");
    await executeAgentProposal(1, baseProposal);
    expect(createOperatorAction).toHaveBeenCalledWith(1, expect.objectContaining({
      kind: "scope_checked",
      status: "review",
      subject: expect.stringContaining("Agent execution"),
    }));
  });

  it("blocked CEX orders emit a blocked action", async () => {
    const { createOperatorAction } = await import("./db");
    await executeCexOrder(1, baseProposal);
    expect(createOperatorAction).toHaveBeenCalledWith(1, expect.objectContaining({
      kind: "simulation_blocked",
      status: "blocked",
    }));
  });

  it("blocked on-chain txs emit a blocked action", async () => {
    const { createOperatorAction } = await import("./db");
    await executeOnChainTx(1, { ...baseProposal, venue: "evm" });
    expect(createOperatorAction).toHaveBeenCalledWith(1, expect.objectContaining({
      kind: "simulation_blocked",
      status: "blocked",
    }));
  });
});
