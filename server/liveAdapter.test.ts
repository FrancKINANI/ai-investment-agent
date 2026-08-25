import { describe, expect, it } from "vitest";
import { checkMandateAllowance, type LiveOrderRequest } from "./liveAdapter";

describe("live adapter mandate checks", () => {
  const baseMandate = {
    mandateId: "mandate-1",
    mode: "real" as const,
    status: "active" as const,
    venue: "binance" as const,
    maxOrderBps: 250, // 2.5% of balance
    dailyCapBps: 1000, // 10% of balance
    allowedAssets: ["BTCUSDT", "ETHUSDT"],
  };

  const marketOrder: LiveOrderRequest = {
    symbol: "BTCUSDT",
    side: "BUY",
    type: "MARKET",
    quoteOrderQty: 100,
  };

  const limitOrder: LiveOrderRequest = {
    symbol: "ETHUSDT",
    side: "SELL",
    type: "LIMIT",
    quantity: 0.5,
    price: 3000,
  };

  it("allows an order within mandate limits", () => {
    const result = checkMandateAllowance(baseMandate, marketOrder, 10_000);
    expect(result.allowed).toBe(true);
    expect(result.mandateId).toBe("mandate-1");
  });

  it("blocks when no mandate exists", () => {
    const result = checkMandateAllowance(null, marketOrder, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("No active mandate");
  });

  it("blocks when mandate is not active", () => {
    const result = checkMandateAllowance({ ...baseMandate, status: "paused" }, marketOrder, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("paused");
  });

  it("blocks when mandate mode is simulation", () => {
    const result = checkMandateAllowance({ ...baseMandate, mode: "simulation" }, marketOrder, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("simulation");
  });

  it("allows mandate mode armed (pre-execution state)", () => {
    const result = checkMandateAllowance({ ...baseMandate, mode: "armed" }, marketOrder, 10_000);
    expect(result.allowed).toBe(true);
  });

  it("blocks when venue does not match", () => {
    const result = checkMandateAllowance({ ...baseMandate, venue: "evm" as const }, marketOrder, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("evm");
  });

  it("blocks when asset is not in allowed list", () => {
    const result = checkMandateAllowance(baseMandate, { ...marketOrder, symbol: "DOGEUSDT" }, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("DOGE");
  });

  it("blocks when order exceeds max order size (quoteOrderQty)", () => {
    // $500 on $10,000 balance = 500bps, mandate max is 250bps
    const result = checkMandateAllowance(baseMandate, { ...marketOrder, quoteOrderQty: 500 }, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeds mandate max");
  });

  it("blocks when limit order value exceeds max order size", () => {
    // 0.5 ETH * $3000 = $1500, on $10,000 balance = 1500bps, mandate max is 250bps
    const result = checkMandateAllowance(baseMandate, limitOrder, 10_000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeds mandate max");
  });

  it("allows when order is within limits", () => {
    // $200 on $10,000 balance = 200bps, mandate max is 250bps
    const result = checkMandateAllowance(baseMandate, { ...marketOrder, quoteOrderQty: 200 }, 10_000);
    expect(result.allowed).toBe(true);
  });

  it("allows when allowedAssets is empty (all assets permitted)", () => {
    const result = checkMandateAllowance({ ...baseMandate, allowedAssets: [] }, { ...marketOrder, symbol: "DOGEUSDT" }, 10_000);
    expect(result.allowed).toBe(true);
  });

  it("includes mandate mode in the result when allowed", () => {
    const result = checkMandateAllowance(baseMandate, marketOrder, 10_000);
    expect(result.mode).toBe("real");
  });
});

describe("live adapter safety contracts", () => {
  it("mandate check never allows execution without a valid mandate", () => {
    const order: LiveOrderRequest = { symbol: "BTCUSDT", side: "BUY", type: "MARKET", quoteOrderQty: 100 };
    expect(checkMandateAllowance(null, order, 10_000).allowed).toBe(false);
    expect(checkMandateAllowance({ mandateId: "m1", mode: "simulation", status: "active", venue: "binance", maxOrderBps: 250, dailyCapBps: 1000, allowedAssets: [] }, order, 10_000).allowed).toBe(false);
    expect(checkMandateAllowance({ mandateId: "m1", mode: "real", status: "paused", venue: "binance", maxOrderBps: 250, dailyCapBps: 1000, allowedAssets: [] }, order, 10_000).allowed).toBe(false);
  });

  it("mandate check enforces order size limits proportional to balance", () => {
    const order: LiveOrderRequest = { symbol: "BTCUSDT", side: "BUY", type: "MARKET", quoteOrderQty: 300 };
    const mandate = { mandateId: "m1", mode: "real" as const, status: "active" as const, venue: "binance" as const, maxOrderBps: 250, dailyCapBps: 1000, allowedAssets: [] };

    // $300 on $10,000 = 300bps > 250bps max → blocked
    expect(checkMandateAllowance(mandate, order, 10_000).allowed).toBe(false);
    // $300 on $20,000 = 150bps < 250bps max → allowed
    expect(checkMandateAllowance(mandate, order, 20_000).allowed).toBe(true);
  });
});
