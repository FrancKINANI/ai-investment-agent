import { describe, expect, it } from "vitest";
import { buildLiveApprovalBinding } from "./liveOrderAuthorization";
import { createServerDerivedLiveOrderIntent } from "./liveOrderIntent";
import { mapBinanceOrderStatus } from "@shared/liveLedger";
import { BinanceApiError } from "./binance";

const now = 1_700_000_000_000;
const intentInput = {
  venue: "binance" as const, platformKeyId: "key-1", keyVersion: 2, mandateId: "mandate-1", mandateVersion: 3,
  authorityState: "approval-required-live" as const, authorityVersion: 1, approvalExpiresAtMs: now + 60_000,
  verifiedBalance: { availableUsd: 10_000, source: "binance-account" as const, observedAtMs: now },
  order: { symbol: "btcusdt", side: "BUY" as const, type: "LIMIT" as const, quantity: 0.01, quoteOrderQty: null, price: 60_000, timeInForce: "GTC" as const },
};

describe("pre-unseal live-order intent", () => {
  it("requires a real canonical symbol, positive verified balance, and fresh snapshot", () => {
    expect(() => createServerDerivedLiveOrderIntent({ ...intentInput, nowMs: now })).not.toThrow();
    expect(() => createServerDerivedLiveOrderIntent({ ...intentInput, verifiedBalance: { ...intentInput.verifiedBalance, availableUsd: 0 }, nowMs: now })).toThrow(/verified positive/i);
    expect(() => createServerDerivedLiveOrderIntent({ ...intentInput, order: { ...intentInput.order, symbol: "UNKNOWN" }, nowMs: now })).toThrow(/canonical Binance symbol/i);
    expect(() => createServerDerivedLiveOrderIntent({ ...intentInput, verifiedBalance: { ...intentInput.verifiedBalance, observedAtMs: now - 60_001 }, nowMs: now })).toThrow(/fresh verified balance/i);
  });

  it("mints a server-owned idempotency key and normalizes the canonical symbol", () => {
    const intent = createServerDerivedLiveOrderIntent({ ...intentInput, nowMs: now });
    expect(intent.executionMode).toBe("live");
    expect(intent.order.symbol).toBe("BTCUSDT");
    expect(intent.idempotencyKey).toMatch(/^live_/);
  });
});

describe("cryptographic approval binding", () => {
  const payload = {
    venue: "binance" as const, platformKeyId: "key-1", keyVersion: 2, symbol: "BTCUSDT", side: "BUY" as const,
    type: "LIMIT" as const, quantity: 0.01, quoteOrderQty: null, price: 60_000, timeInForce: "GTC" as const,
    idempotencyKey: "live_server_generated_idempotency_key", mandateId: "mandate-1", mandateVersion: 3,
    authorityState: "approval-required-live" as const, authorityVersion: 1, expiresAtMs: Date.now() + 60_000,
  };

  it("uses a SHA-256 digest and invalidates every bound order field", () => {
    const baseline = buildLiveApprovalBinding(payload);
    expect(baseline.approvalDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(buildLiveApprovalBinding({ ...payload, price: 60_001 }).approvalDigest).not.toBe(baseline.approvalDigest);
    expect(buildLiveApprovalBinding({ ...payload, platformKeyId: "key-2" }).approvalDigest).not.toBe(baseline.approvalDigest);
    expect(buildLiveApprovalBinding({ ...payload, mandateVersion: 4 }).approvalDigest).not.toBe(baseline.approvalDigest);
    expect(buildLiveApprovalBinding({ ...payload, authorityVersion: 2 }).approvalDigest).not.toBe(baseline.approvalDigest);
    expect(buildLiveApprovalBinding({ ...payload, expiresAtMs: payload.expiresAtMs + 1 }).approvalDigest).not.toBe(baseline.approvalDigest);
  });
});

describe("Binance lifecycle mapping", () => {
  it.each([
    ["NEW", "acknowledged"], ["PARTIALLY_FILLED", "partially_filled"], ["FILLED", "filled"],
    ["CANCELED", "cancelled"], ["EXPIRED", "cancelled"], ["REJECTED", "rejected"], ["unrecognized", "unknown"],
  ] as const)("maps %s to %s without inferring a fill", (status, expected) => {
    expect(mapBinanceOrderStatus(status).eventType).toBe(expected);
  });

  it("exposes only stable public Binance error classifications", () => {
    expect(new BinanceApiError("BINANCE_TIMEOUT", "Binance did not respond before the request timeout.").message).not.toMatch(/api.?key|secret/i);
  });
});
