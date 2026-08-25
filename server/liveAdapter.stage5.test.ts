import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getAuthorityState: vi.fn(),
  getPlatformApiKey: vi.fn(),
  getLiveOrderByIdempotencyKey: vi.fn().mockResolvedValue(null),
  consumeLiveOrderApproval: vi.fn().mockResolvedValue(true),
  appendLedgerEvent: vi.fn().mockResolvedValue(undefined),
  createOperatorAction: vi.fn().mockResolvedValue({}),
  createSecurityAlert: vi.fn().mockResolvedValue({}),
}));
vi.mock("./kms", () => ({ decryptSecret: vi.fn((v: string) => `dec:${v}`) }));
vi.mock("./binance", () => ({ placeOrder: vi.fn() }));
const tickerRead = vi.fn();
vi.mock("./liveData", () => ({ readBinanceTicker: (...a: unknown[]) => tickerRead(...a) }));

import { executeLiveOrder, type LiveOrderRequest } from "./liveAdapter";
import { getAuthorityState, getPlatformApiKey, getLiveOrderByIdempotencyKey, consumeLiveOrderApproval, appendLedgerEvent } from "./db";
import { placeOrder as binancePlaceOrder } from "./binance";

const mandate = {
  mandateId: "mandate-1",
  mode: "real",
  status: "active",
  venue: "binance",
  maxOrderBps: 250,
  dailyCapBps: 1000,
  allowedAssets: ["BTCUSDT"],
};

const order: LiveOrderRequest = {
  symbol: "BTCUSDT",
  side: "BUY",
  type: "MARKET",
  quoteOrderQty: 100,
  idempotencyKey: "live-key-0000001",
};

function freshPrice() {
  return { ok: true as const, data: { symbol: "BTCUSDT", price: 50_000 }, source: "binance", fetchedAtMs: Date.now(), latencyMs: 5 };
}

function setup(state: Parameters<typeof getAuthorityState.mockReturnValue>[0]) {
  vi.mocked(getAuthorityState).mockResolvedValue(state);
  vi.mocked(getLiveOrderByIdempotencyKey).mockResolvedValue(null);
  vi.mocked(consumeLiveOrderApproval).mockResolvedValue(true);
  tickerRead.mockResolvedValue(freshPrice());
  vi.mocked(getPlatformApiKey).mockResolvedValue({ keyId: "key-1", state: "active", apiKeyEncrypted: "x", secretEncrypted: "y" } as never);
  vi.mocked(binancePlaceOrder).mockResolvedValue({
    orderId: 123456, symbol: "BTCUSDT", side: "BUY", type: "MARKET", status: "FILLED",
    price: "50000", origQty: "0.002", cummulativeQuoteQty: "100",
  } as never);
}

describe("Stage 5 negative tests — limited live execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup("limited-live");
  });

  it("fills a live order in limited-live with mandate agreement and records submitted+filled ledger events", async () => {
    const { result } = await executeLiveOrder(1, "key-1", mandate, order, 10_000);
    expect(result.orderId).toBe(123456);
    const events = vi.mocked(appendLedgerEvent).mock.calls.map((c) => c[1].eventType);
    expect(events[0]).toBe("submitted");
    expect(events[events.length - 1]).toBe("filled");
  });

  it("BLOCKS when mandate/authority disagree (mandate 'simulation' under limited-live)", async () => {
    await expect(executeLiveOrder(1, "key-1", { ...mandate, mode: "simulation" }, order, 10_000))
      .rejects.toThrow(/does not express live intent/);
    expect(binancePlaceOrder).not.toHaveBeenCalled();
  });

  it("approval-required-live without a per-order approval blocks with the approval hash in the message", async () => {
    setup("approval-required-live");
    vi.mocked(consumeLiveOrderApproval).mockResolvedValue(false);
    await expect(executeLiveOrder(1, "key-1", mandate, order, 10_000))
      .rejects.toThrow(/per-order owner approval.*approve the exact order hash/is);
    expect(binancePlaceOrder).not.toHaveBeenCalled();
  });

  it("approval-required-live consumes the single-use approval and fills", async () => {
    setup("approval-required-live");
    const { result } = await executeLiveOrder(1, "key-1", mandate, order, 10_000);
    expect(consumeLiveOrderApproval).toHaveBeenCalledWith(1, expect.any(String));
    expect(result.orderId).toBe(123456);
  });

  it("paused authority blocks mid-pipeline even with everything else in place", async () => {
    setup("paused");
    await expect(executeLiveOrder(1, "key-1", mandate, order, 10_000)).rejects.toThrow(/dominant state|blocks all/i);
    expect(binancePlaceOrder).not.toHaveBeenCalled();
  });

  it("stale reference price blocks market orders before submission", async () => {
    tickerRead.mockResolvedValue({ ok: false, source: "binance", errorKind: "timeout", message: "timed out" });
    await expect(executeLiveOrder(1, "key-1", mandate, order, 10_000))
      .rejects.toThrow(/no fresh reference price/i);
    expect(binancePlaceOrder).not.toHaveBeenCalled();
  });

  it("duplicate idempotency key returns the original outcome WITHOUT calling Binance and without new submit events", async () => {
    vi.mocked(getLiveOrderByIdempotencyKey).mockResolvedValue({
      orderId: 999, status: "FILLED", outcome: { orderId: 999, status: "FILLED", price: "50000", origQty: "0.002", executedQty: "100" },
    });
    const callsBefore = vi.mocked(binancePlaceOrder).mock.calls.length;
    const eventsBefore = vi.mocked(appendLedgerEvent).mock.calls.length;
    const { result, mandateCheck } = await executeLiveOrder(1, "key-1", mandate, order, 10_000);
    expect(result.orderId).toBe(999); // original outcome
    expect(mandateCheck.reason).toContain("without re-submission");
    expect(vi.mocked(binancePlaceOrder).mock.calls.length).toBe(callsBefore); // no venue call
    expect(vi.mocked(appendLedgerEvent).mock.calls.length).toBe(eventsBefore); // no new events
  });

  it("missing idempotency key is refused outright", async () => {
    await expect(executeLiveOrder(1, "key-1", mandate, { ...order, idempotencyKey: undefined }, 10_000))
      .rejects.toThrow(/idempotencyKey/);
    expect(binancePlaceOrder).not.toHaveBeenCalled();
  });

  it("venue rejection after submission is recorded truthfully as a rejected reconciliation event", async () => {
    vi.mocked(binancePlaceOrder).mockRejectedValue(new Error("Insufficient balance."));
    await expect(executeLiveOrder(1, "key-1", mandate, order, 10_000)).rejects.toThrow(/Insufficient balance/);
    const events = vi.mocked(appendLedgerEvent).mock.calls.map((c) => c[1].eventType);
    expect(events[0]).toBe("submitted");
    expect(events[events.length - 1]).toBe("rejected");
    const lastPayload = vi.mocked(appendLedgerEvent).mock.calls.at(-1)![1].payload as { outcome: { reason: string } };
    expect(lastPayload.outcome.reason).toContain("Insufficient balance");
  });
});

describe("Stage 5.1 review fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup("approval-required-live");
  });

  it("R1: a duplicate idempotency key short-circuits BEFORE consuming an approval or reading prices", async () => {
    vi.mocked(getLiveOrderByIdempotencyKey).mockResolvedValue({
      orderId: "ll-orig-1",
      status: "FILLED",
      outcome: { price: "50000", origQty: "0.002", executedQty: "100" },
    } as never);
    const result = await executeLiveOrder(1, "key-1", mandate, order, 10_000);
    expect(result.result.orderId).toBe("ll-orig-1");
    // The retry must not have consumed anything nor touched the venue:
    expect(consumeLiveOrderApproval).not.toHaveBeenCalled();
    expect(tickerRead).not.toHaveBeenCalled();
    expect(binancePlaceOrder).not.toHaveBeenCalled();
  });

  it("R4: LIMIT orders skip the freshness gate (they carry their own price) but still require idempotency + approval", async () => {
    const limitOrder: LiveOrderRequest = {
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      quantity: 0.002,
      price: 49_000,
      idempotencyKey: "live-key-0000002",
    };
    tickerRead.mockRejectedValue(new Error("network must not be touched for LIMIT"));
    await expect(executeLiveOrder(1, "key-1", mandate, limitOrder, 10_000)).resolves.toBeTruthy();
    expect(tickerRead).not.toHaveBeenCalled();
    expect(binancePlaceOrder).toHaveBeenCalledTimes(1);
  });
});
