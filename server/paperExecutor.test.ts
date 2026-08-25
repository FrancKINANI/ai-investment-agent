import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getAuthorityState: vi.fn(),
  getPaperOrderByIdempotencyKey: vi.fn().mockResolvedValue(null),
  appendLedgerEvent: vi.fn().mockResolvedValue(undefined),
  upsertPaperOrderProjection: vi.fn().mockResolvedValue(undefined),
  createOperatorAction: vi.fn().mockResolvedValue({}),
  getDb: vi.fn().mockResolvedValue({}),
}));
vi.mock("../drizzle/schema", () => ({ paperOrders: {} }));
vi.mock("./liveData", () => ({
  readBinanceTicker: vi.fn().mockResolvedValue({ ok: false, source: "binance", errorKind: "authority-blocked", message: "mocked off" }),
}));

import { submitPaperOrder, reconcilePaperOrder } from "./paperExecutor";
import { getAuthorityState, appendLedgerEvent, getPaperOrderByIdempotencyKey } from "./db";

const NOW = Date.now();
const input = {
  idempotencyKey: "idem-key-0001",
  venue: "binance" as const,
  symbol: "BTCUSDT",
  side: "BUY" as const,
  orderType: "MARKET" as const,
  quoteOrderQty: 100,
};

const mandate = {
  mandateId: "mandate-1",
  status: "active",
  venue: "binance",
  maxOrderBps: 250,
  dailyCapBps: 1000,
  allowedAssets: ["BTCUSDT"],
};

function setup(state: Parameters<typeof getAuthorityState.mockReturnValue>[0]) {
  vi.mocked(getAuthorityState).mockResolvedValue(state);
}

describe("submitPaperOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPaperOrderByIdempotencyKey as never).mockResolvedValue(null);    setup("sandbox-only");
  });

  it("walks the full lifecycle proposed → validated → submitted → filled", async () => {
    const result = await submitPaperOrder({
      userId: 1,
      input,
      mandate,
      referencePrice: { price: 50_000, timestampMs: NOW - 1_000 },
    });
    expect(result.status).toBe("filled");
    const events = vi.mocked(appendLedgerEvent).mock.calls.map((c) => c[1].eventType);
    expect(events).toEqual(["proposed", "validated", "submitted", "filled"]);
  });

  it("records rejected attempts in the ledger too (proposed → rejected)", async () => {
    const result = await submitPaperOrder({
      userId: 1,
      input: { ...input, symbol: "SOLUSDT" }, // not in allowed assets
      mandate,
      referencePrice: { price: 100, timestampMs: NOW - 1_000 },
    });
    expect(result.status).toBe("rejected");
    const events = vi.mocked(appendLedgerEvent).mock.calls.map((c) => c[1].eventType);
    expect(events).toEqual(["proposed", "rejected"]);
  });

  it("blocks everything when authority state is revoked", async () => {
    setup("revoked");
    const result = await submitPaperOrder({
      userId: 1,
      input,
      mandate,
      referencePrice: { price: 50_000, timestampMs: NOW - 1_000 },
    });
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") expect(result.reason).toContain("revoked");
  });

  it("returns the existing order on repeated idempotency key without new ledger events", async () => {
    const { getPaperOrderByIdempotencyKey } = await import("./db");
    vi.mocked(getPaperOrderByIdempotencyKey as never).mockResolvedValue({ orderId: "po-dup", status: "filled" });
    const before = vi.mocked(appendLedgerEvent).mock.calls.length;
    const result = await submitPaperOrder({
      userId: 1,
      input,
      mandate,
      referencePrice: { price: 50_000, timestampMs: NOW - 1_000 },
    });
    expect(result).toEqual({ status: "duplicate", orderId: "po-dup" });
    expect(vi.mocked(appendLedgerEvent).mock.calls.length).toBe(before); // no new events
  });

  it("refuses to simulate a fill without a fresh reference price", async () => {
    const result = await submitPaperOrder({ userId: 1, input, mandate, referencePrice: null });
    expect(result.status === "rejected" && result.reason).toContain("No valid reference price");
  });
});

describe("reconcilePaperOrder guards", () => {
  it("cannot reconcile an order that was never filled", async () => {
    const { getDb } = await import("./db");
    vi.mocked(getDb as never).mockResolvedValue({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    });
    const r = await reconcilePaperOrder(1, "po-missing", "matched");
    expect(r.ok).toBe(false);
  });
});

describe("stage 2: server-side reference price preference", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getPaperOrderByIdempotencyKey } = await import("./db");
    vi.mocked(getPaperOrderByIdempotencyKey as never).mockResolvedValue(null);
    setup("read-only-live");
  });

  it("uses the verified upstream price over a client-supplied one when reads are permitted", async () => {
    const { readBinanceTicker } = await import("./liveData");
    vi.mocked(readBinanceTicker as never).mockResolvedValue({
      ok: true, data: { symbol: "BTCUSDT", price: 49_000 }, source: "binance", fetchedAtMs: Date.now(), latencyMs: 5,
    } as never);

    // Client claims the price is 60,000; server truth says 49,000.
    const result = await submitPaperOrder({
      userId: 1,
      input,
      mandate,
      mandateBalanceUsd: 10_000,
      referencePrice: { price: 60_000, timestampMs: Date.now() - 1_000 },
    });

    expect(result.status).toBe("filled");
    if (result.status === "filled") expect(result.fillPrice).toBe(49_000); // server truth wins
  });
});
