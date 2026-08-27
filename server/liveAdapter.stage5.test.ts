import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getAuthorityState: vi.fn(),
  getPlatformApiKey: vi.fn(),
  listWalletMandates: vi.fn(),
  getLiveOrderByIdempotencyKey: vi.fn(),
  claimLiveOrderIntent: vi.fn(),
  reserveLiveDailyRisk: vi.fn(),
  updateLiveOrderIntentStatus: vi.fn(),
  consumeLiveOrderApproval: vi.fn(),
  appendLedgerEvent: vi.fn(),
  createOperatorAction: vi.fn(),
  createSecurityAlert: vi.fn(),
}));
vi.mock("./kms", () => ({ decryptSecret: vi.fn((value: string) => `decrypted:${value}`) }));
vi.mock("./binance", () => ({ placeOrder: vi.fn(), cancelOrder: vi.fn(), getBalances: vi.fn(), getOpenOrders: vi.fn() }));
vi.mock("./liveData", () => ({ readBinanceTicker: vi.fn() }));

import { cancelLiveOrder, checkMandateAllowance, executeLiveOrder, type LiveOrderRequest } from "./liveAdapter";
import { cancelOrder as binanceCancelOrder, placeOrder as binancePlaceOrder } from "./binance";
import { decryptSecret } from "./kms";
import { getAuthorityState, listWalletMandates } from "./db";

const mandate = {
  mandateId: "mandate-1",
  mode: "real",
  status: "active",
  venue: "binance",
  maxOrderBps: 250,
  dailyCapBps: 1_000,
  allowedAssets: ["BTCUSDT"],
};

const order: LiveOrderRequest = {
  symbol: "BTCUSDT",
  side: "BUY",
  type: "MARKET",
  quoteOrderQty: 100,
  idempotencyKey: "live-key-0000001",
};

describe("Stage 5 security boundary — sealed venue mutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["disabled", "paused", "revoked", "read-only-live", "limited-live", "approval-required-live"] as const)(
    "refuses placement under %s without decrypting or contacting Binance",
    async (state) => {
      vi.mocked(getAuthorityState).mockResolvedValue(state);
      await expect(executeLiveOrder(1, "key-1", mandate, order, 10_000)).rejects.toThrow(/sealed|does not permit|blocks all/i);
      expect(decryptSecret).not.toHaveBeenCalled();
      expect(binancePlaceOrder).not.toHaveBeenCalled();
    },
  );

  it("refuses cancellation before key decryption or any Binance mutation", async () => {
    vi.mocked(getAuthorityState).mockResolvedValue("limited-live");
    vi.mocked(listWalletMandates).mockResolvedValue([mandate] as never);
    await expect(cancelLiveOrder(1, "key-1", "BTCUSDT", 123)).rejects.toThrow(/sealed/i);
    expect(decryptSecret).not.toHaveBeenCalled();
    expect(binanceCancelOrder).not.toHaveBeenCalled();
  });
});

describe("live mandate risk validation", () => {
  it("refuses an order when the verified balance is absent instead of bypassing BPS limits", () => {
    const result = checkMandateAllowance(mandate, order, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/verified positive account balance/i);
  });

  it("refuses a quantity-only market order when no trusted price has been resolved", () => {
    const result = checkMandateAllowance(mandate, { ...order, quoteOrderQty: undefined, quantity: 1, price: undefined }, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/verified positive USD order value/i);
  });

  it("requires an exact symbol or base asset match rather than accepting substrings", () => {
    const result = checkMandateAllowance({ ...mandate, allowedAssets: ["BTC"] }, { ...order, symbol: "NOTBTCUSDT" }, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not in the allowed assets list/i);
  });
});
