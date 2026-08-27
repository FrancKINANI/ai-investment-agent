import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getAuthorityState: vi.fn(), getAuthoritySnapshot: vi.fn(), getPlatformApiKey: vi.fn(), listWalletMandates: vi.fn(),
  getLiveOrderByIdempotencyKey: vi.fn(), claimLiveOrderIntent: vi.fn(), reserveLiveDailyRisk: vi.fn(),
  updateLiveOrderIntentStatus: vi.fn(), consumeLiveOrderApproval: vi.fn(), appendLedgerEvent: vi.fn(),
  createOperatorAction: vi.fn(), createSecurityAlert: vi.fn(),
}));
vi.mock("./kms", () => ({ decryptSecret: vi.fn((value: string) => `decrypted:${value}`) }));
vi.mock("./binance", () => ({ placeOrder: vi.fn(), cancelOrder: vi.fn(), getBalances: vi.fn(), getOpenOrders: vi.fn() }));
vi.mock("./liveData", () => ({ readBinanceTicker: vi.fn() }));

import { cancelLiveOrder, checkMandateAllowance, executeLiveOrder } from "./liveAdapter";
import { cancelOrder as binanceCancelOrder, placeOrder as binancePlaceOrder } from "./binance";
import { decryptSecret } from "./kms";
import { getAuthoritySnapshot, listWalletMandates } from "./db";
import type { ServerDerivedLiveOrderIntent } from "./liveOrderIntent";

const mandate = { mandateId: "mandate-1", mode: "real", status: "active", venue: "binance", maxOrderBps: 250, dailyCapBps: 1_000, allowedAssets: ["BTCUSDT"], version: 1 };
const order = { symbol: "BTCUSDT", side: "BUY" as const, type: "MARKET" as const, quoteOrderQty: 100 };

function makeIntent(state: ServerDerivedLiveOrderIntent["authorityState"] = "limited-live"): ServerDerivedLiveOrderIntent {
  return {
    executionMode: "live", venue: "binance", platformKeyId: "key-1", keyVersion: 1,
    mandateId: "mandate-1", mandateVersion: 1, authorityState: state, authorityVersion: 1,
    approvalExpiresAtMs: Date.now() + 60_000,
    order: { ...order, quantity: null, price: null, timeInForce: "GTC" },
    verifiedBalance: { availableUsd: 10_000, source: "binance-account", observedAtMs: Date.now() },
    idempotencyKey: "live_server_generated_idempotency_key",
  };
}

describe("sealed venue mutation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listWalletMandates).mockResolvedValue([mandate] as never);
  });

  it.each(["limited-live", "approval-required-live"] as const)(
    "refuses placement under %s without decrypting or contacting Binance",
    async (state) => {
      vi.mocked(getAuthoritySnapshot).mockResolvedValue({ state, version: 1 });
      await expect(executeLiveOrder(1, makeIntent(state))).rejects.toThrow(/sealed/i);
      expect(decryptSecret).not.toHaveBeenCalled();
      expect(binancePlaceOrder).not.toHaveBeenCalled();
    },
  );

  it("refuses cancellation before key decryption or any Binance mutation", async () => {
    vi.mocked(getAuthoritySnapshot).mockResolvedValue({ state: "limited-live", version: 1 });
    vi.mocked(listWalletMandates).mockResolvedValue([mandate] as never);
    await expect(cancelLiveOrder(1, "key-1", "BTCUSDT", 123)).rejects.toThrow(/sealed/i);
    expect(decryptSecret).not.toHaveBeenCalled();
    expect(binanceCancelOrder).not.toHaveBeenCalled();
  });
});

describe("live mandate risk validation", () => {
  it("refuses an order when the verified balance is absent", () => {
    expect(checkMandateAllowance(mandate, order, 0).allowed).toBe(false);
  });

  it("refuses a quantity-only market order without a trusted price", () => {
    expect(checkMandateAllowance(mandate, { ...order, quoteOrderQty: undefined, quantity: 1, price: undefined }, 10_000).allowed).toBe(false);
  });
});
