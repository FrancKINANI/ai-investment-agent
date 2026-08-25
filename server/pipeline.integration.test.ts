import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks (hoisted before imports) ──────────────────────────────────────

vi.mock("./db", () => ({
  listWalletMandates: vi.fn().mockResolvedValue([]),
  getPlatformApiKey: vi.fn().mockResolvedValue(null),
  createOperatorAction: vi.fn().mockResolvedValue({ id: 1 }),
  createSecurityAlert: vi.fn().mockResolvedValue({ id: 1 }),
  listSecurityAlerts: vi.fn().mockResolvedValue([]),
  countUnacknowledgedAlerts: vi.fn().mockResolvedValue(0),
  addPlatformApiKey: vi.fn(),
  disablePlatformApiKey: vi.fn(),
  deletePlatformApiKey: vi.fn(),
  updatePlatformApiKeyLimits: vi.fn(),
  updatePlatformApiKeyStatus: vi.fn(),
}));

vi.mock("./liveAdapter", () => ({
  executeLiveOrder: vi.fn().mockRejectedValue(new Error("No DB")),
  getLiveBalances: vi.fn().mockRejectedValue(new Error("No DB")),
  getLiveTicker: vi.fn().mockRejectedValue(new Error("No DB")),
  checkMandateAllowance: vi.fn().mockReturnValue({ allowed: false, reason: "No DB" }),
}));

vi.mock("./sailorService", () => ({
  listMandates: vi.fn().mockReturnValue([]),
  executeMandateTransaction: vi.fn().mockRejectedValue(new Error("No DB")),
  getMandate: vi.fn().mockReturnValue(undefined),
}));

vi.mock("./binance", () => ({
  getAccountBalances: vi.fn().mockRejectedValue(new Error("No DB")),
  getSymbolTicker: vi.fn().mockRejectedValue(new Error("No DB")),
  placeOrder: vi.fn().mockRejectedValue(new Error("No DB")),
  testConnectivity: vi.fn().mockRejectedValue(new Error("No DB")),
}));

import { executeCexOrder, executeOnChainTx, executeAgentProposal, type AgentProposal } from "./agentExecutor";
import * as db from "./db";
import * as liveAdapter from "./liveAdapter";
import * as sailorService from "./sailorService";

// ─── Fixtures ─────────────────────────────────────────────────────────────

const activeBinanceMandate = {
  id: 1,
  userId: 42,
  walletId: "wc-1",
  mandateId: "mandate-binance-1",
  mode: "real",
  status: "active",
  venue: "binance",
  maxOrderBps: 250,
  dailyCapBps: 1000,
  allowedAssets: ["BTCUSDT", "ETHUSDT"],
  activatedAt: new Date().toISOString(),
};

const activeSailorMandate = {
  id: 2,
  userId: 42,
  walletId: "wc-2",
  mandateId: "mandate-sailor-1",
  mode: "real",
  status: "active",
  venue: "evm",
  chainId: 1,
  maxOrderBps: 500,
  dailyCapBps: 2000,
  allowedAssets: [],
  activatedAt: new Date().toISOString(),
  revokedAt: null,
  scopes: ["swap"],
  valueCapUsd: 10000,
};

const activeApiKey = {
  id: 1,
  userId: 42,
  platform: "binance",
  apiKeyMasked: "abcd****1234",
  secretEncrypted: "encrypted-secret",
  permissions: ["trading"],
  status: "success",
  maxOrderUsd: 10000,
  allocatedCapitalUsd: 50000,
  maxTradesPerDay: 100,
  withdrawAllowed: false,
};

const cexProposal: AgentProposal = {
  proposalId: "prop-1",
  title: "Buy BTC",
  rationale: "Bull case strong",
  action: { kind: "token_swap", symbol: "BTCUSDT", side: "BUY", type: "MARKET", quoteOrderQty: 100 },
  venue: "binance",
  walletRole: "trading",
  status: "approved",
};

const onChainProposal: AgentProposal = {
  proposalId: "prop-2",
  title: "Swap ETH for USDC",
  rationale: "DeFi opportunity",
  action: { kind: "token_swap", protocol: "uniswap", amount: "1.5" },
  venue: "evm",
  walletRole: "trading",
  status: "approved",
};

// ─── CEX Pipeline Tests ───────────────────────────────────────────────────

describe("CEX execution pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.listWalletMandates).mockResolvedValue([activeBinanceMandate] as any);
    vi.mocked(db.getPlatformApiKey).mockResolvedValue(activeApiKey as any);
  });

  it("executes a CEX order when mandate and API key exist", async () => {
    vi.mocked(liveAdapter.executeLiveOrder).mockResolvedValue({
      result: { orderId: 12345, symbol: "BTCUSDT", side: "BUY", type: "MARKET", status: "FILLED", price: "60000", quantity: "0.001", executedQty: "0.001" },
      mandateCheck: { allowed: true, mandateId: "mandate-binance-1", mode: "real" },
    });

    const result = await executeCexOrder(42, cexProposal, "key-1");

    expect(result.success).toBe(true);
    expect(result.orderId).toBe(12345);
    expect(result.type).toBe("cex");
    expect(liveAdapter.executeLiveOrder).toHaveBeenCalled();
  });

  it("rejects order when no API key is specified", async () => {
    const result = await executeCexOrder(42, cexProposal);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No Binance API key");
  });

  it("rejects order in simulation mode", async () => {
    vi.mocked(db.listWalletMandates).mockResolvedValue([{
      ...activeBinanceMandate,
      mode: "simulation",
    }] as any);

    const result = await executeCexOrder(42, cexProposal, "key-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("simulation");
  });

  it("allows order in armed mode", async () => {
    vi.mocked(db.listWalletMandates).mockResolvedValue([{
      ...activeBinanceMandate,
      mode: "armed",
    }] as any);
    vi.mocked(liveAdapter.executeLiveOrder).mockResolvedValue({
      result: { orderId: 99999, symbol: "BTCUSDT", side: "BUY", type: "MARKET", status: "FILLED", price: "60000", quantity: "0.001", executedQty: "0.001" },
      mandateCheck: { allowed: true, mandateId: "mandate-binance-1", mode: "armed" },
    });

    const result = await executeCexOrder(42, cexProposal, "key-1");
    expect(result.success).toBe(true);
  });

  it("blocks order in paused mandate", async () => {
    vi.mocked(db.listWalletMandates).mockResolvedValue([{
      ...activeBinanceMandate,
      status: "paused",
    }] as any);

    const result = await executeCexOrder(42, cexProposal, "key-1");
    expect(result.success).toBe(false);
  });

  it("logs blocked action when no mandate exists", async () => {
    vi.mocked(db.listWalletMandates).mockResolvedValue([]);

    await executeCexOrder(42, cexProposal);
    expect(db.createOperatorAction).toHaveBeenCalledWith(42, expect.objectContaining({
      kind: "simulation_blocked",
      status: "blocked",
    }));
  });

  it("emits alert on execution failure", async () => {
    vi.mocked(liveAdapter.executeLiveOrder).mockRejectedValue(new Error("Network timeout"));

    await executeCexOrder(42, cexProposal, "key-1");
    expect(db.createSecurityAlert).toHaveBeenCalledWith(42, expect.objectContaining({
      level: "warning",
      category: "execution-failed",
    }));
  });
});

// ─── On-Chain Pipeline Tests ──────────────────────────────────────────────

describe("On-chain execution pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sailorService.listMandates).mockReturnValue([activeSailorMandate] as any);
  });

  it("executes an on-chain tx when Sailor mandate exists", async () => {
    vi.mocked(sailorService.executeMandateTransaction).mockResolvedValue({
      success: true,
      txId: "0xabcdef1234567890",
    });

    const result = await executeOnChainTx(42, onChainProposal, 1);

    expect(result.success).toBe(true);
    expect(result.txHash).toContain("0xabcdef");
    expect(result.type).toBe("on-chain");
    expect(sailorService.executeMandateTransaction).toHaveBeenCalled();
  });

  it("rejects on-chain tx when no Sailor mandate exists", async () => {
    vi.mocked(sailorService.listMandates).mockReturnValue([]);

    const result = await executeOnChainTx(42, onChainProposal, 1);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No active Sailor mandate");
    expect(db.createOperatorAction).toHaveBeenCalledWith(42, expect.objectContaining({
      kind: "simulation_blocked",
      status: "blocked",
    }));
  });

  it("rejects on-chain tx when scope is missing", async () => {
    vi.mocked(sailorService.listMandates).mockReturnValue([{
      ...activeSailorMandate,
      scopes: ["stake"], // No "swap" scope
    }] as any);

    const result = await executeOnChainTx(42, onChainProposal, 1);
    expect(result.success).toBe(false);
    expect(result.error).toContain("scope");
    expect(db.createSecurityAlert).toHaveBeenCalledWith(42, expect.objectContaining({
      level: "warning",
      category: "scope-violation",
    }));
  });

  it("emits alert on on-chain execution failure", async () => {
    vi.mocked(sailorService.executeMandateTransaction).mockRejectedValue(new Error("Insufficient gas"));

    await executeOnChainTx(42, onChainProposal, 1);
    expect(db.createSecurityAlert).toHaveBeenCalledWith(42, expect.objectContaining({
      level: "warning",
      category: "execution-failed",
    }));
  });
});

// ─── Proposal Routing Tests ───────────────────────────────────────────────

describe("Agent proposal routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.listWalletMandates).mockResolvedValue([]);
  });

  it("routes binance venue to CEX executor", async () => {
    const result = await executeAgentProposal(42, cexProposal);
    expect(result.type).toBe("cex");
  });

  it("routes evm venue to on-chain executor", async () => {
    const result = await executeAgentProposal(42, onChainProposal);
    expect(result.type).toBe("on-chain");
  });

  it("rejects unknown venue", async () => {
    const result = await executeAgentProposal(42, { ...cexProposal, venue: "solana" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown venue");
  });

  it("logs the execution attempt", async () => {
    await executeAgentProposal(42, cexProposal);
    expect(db.createOperatorAction).toHaveBeenCalledWith(42, expect.objectContaining({
      kind: "scope_checked",
      status: "review",
    }));
  });
});

// ─── Cross-Venue Safety Tests ─────────────────────────────────────────────

describe("Cross-venue safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CEX mandate cannot execute on-chain transactions", async () => {
    vi.mocked(db.listWalletMandates).mockResolvedValue([activeBinanceMandate] as any);
    vi.mocked(sailorService.listMandates).mockReturnValue([]);

    const result = await executeOnChainTx(42, onChainProposal, 1);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No active Sailor mandate");
  });

  it("on-chain mandate cannot execute CEX orders", async () => {
    vi.mocked(db.listWalletMandates).mockResolvedValue([activeSailorMandate] as any);
    vi.mocked(db.getPlatformApiKey).mockResolvedValue(null);

    const result = await executeCexOrder(42, cexProposal);
    expect(result.success).toBe(false);
  });
});
