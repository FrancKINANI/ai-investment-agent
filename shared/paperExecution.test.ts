import { describe, expect, it } from "vitest";
import {
  decidePaperOrder,
  isValidLedgerTransition,
  PaperOrderInput,
  type LedgerEventType,
} from "./paperExecution";

const NOW = 1_700_000_000_000;

const mandate = {
  mandateId: "mandate-1",
  status: "active",
  venue: "binance",
  maxOrderBps: 250,
  dailyCapBps: 1000,
  allowedAssets: ["BTCUSDT"],
};

const input: PaperOrderInput = {
  idempotencyKey: "key-abcdef-001",
  venue: "binance",
  symbol: "BTCUSDT",
  side: "BUY",
  orderType: "MARKET",
  quoteOrderQty: 100,
};

const price = { price: 50_000, timestampMs: NOW - 5_000 };

function decide(overrides: Partial<Parameters<typeof decidePaperOrder>[0]> = {}) {
  return decidePaperOrder({
    input,
    authorityState: "sandbox-only",
    mandate,
    referencePrice: price,
    nowMs: NOW,
    duplicate: null,
    ...overrides,
  });
}

describe("deterministic paper execution", () => {
  it("fills a valid market order at the reference price, zero slippage", () => {
    const d = decide();
    if (d.action !== "execute") throw new Error(`expected execute, got ${JSON.stringify(d)}`);
    expect(d.fill.fillPrice).toBe(50_000);
    expect(d.fill.executedQty).toBeCloseTo(0.002);
    // Deterministic: same inputs → same orderId
    expect(decide().action === "execute" && decide({}).action === "execute").toBe(true);
    const again = decide();
    expect(again).toEqual(d);
  });

  it("derives a stable orderId from the idempotency key", () => {
    const a = decide();
    const b = decidePaperOrder({
      input,
      authorityState: "sandbox-only",
      mandate,
      referencePrice: { price: 51_000, timestampMs: NOW + 999_999 - 1_000 },
      nowMs: NOW + 999_999,
      duplicate: null,
    });
    expect(a.action === "execute" && b.action === "execute" && a.orderId === b.orderId).toBe(true);
  });
});

describe("negative: idempotency", () => {
  it("returns the original order for a repeated idempotency key instead of re-filling", () => {
    const d = decide({ duplicate: { orderId: "po-existing", status: "filled" } });
    expect(d).toEqual({ action: "duplicate", orderId: "po-existing", status: "filled" });
  });

  it("rejects idempotency keys that are too short", () => {
    expect(() => PaperOrderInput.parse({ ...input, idempotencyKey: "short" })).toThrow();
  });
});

describe("negative: authority and mandate gates", () => {
  it.each(["disabled", "read-only-live", "paused", "revoked"] as const)(
    "rejects execution in authority state %s",
    (state) => {
      const d = decide({ authorityState: state });
      expect(d.action).toBe("reject");
    },
  );

  it.each(["sandbox-only", "approval-required-live", "limited-live"] as const)(
    "permits paper execution in authority state %s (paper is strictly weaker than live)",
    (state) => {
      expect(decide({ authorityState: state }).action).toBe("execute");
    },
  );

  it("rejects with no mandate, paused mandate, or venue mismatch", () => {
    expect(decide({ mandate: null }).action).toBe("reject");
    expect(decide({ mandate: { ...mandate, status: "paused" } }).action).toBe("reject");
    expect(decide({ mandate: { ...mandate, venue: "evm" } }).action).toBe("reject");
  });

  it("rejects disallowed assets", () => {
    const d = decidePaperOrder({
      input: { ...input, symbol: "SOLUSDT" },
      authorityState: "sandbox-only",
      mandate,
      referencePrice: price,
      nowMs: NOW,
      duplicate: null,
    });
    expect(d.action === "reject" && d.reason).toContain("not in the allowed assets list");
  });
});

describe("negative: data truthfulness (fail closed on stale/missing prices)", () => {
  it("rejects when no reference price exists", () => {
    const d = decide({ referencePrice: null });
    expect(d.action === "reject" && d.reason).toContain("No valid reference price");
  });

  it("rejects stale prices beyond the freshness window", () => {
    const stale = { price: 50_000, timestampMs: NOW - 120_000 };
    const d = decide({ referencePrice: stale });
    expect(d.action === "reject" && d.reason).toContain("stale");
  });

  it("honors a custom freshness window", () => {
    const slightlyStale = { price: 50_000, timestampMs: NOW - 30_000 };
    expect(decide({ maxPriceAgeMs: 60_000 }).action).toBe("execute");
    expect(decide({ referencePrice: slightlyStale, maxPriceAgeMs: 10_000 }).action).toBe("reject");
  });

  it("rejects future-dated prices as inconsistent data", () => {
    const d = decide({ referencePrice: { price: 50_000, timestampMs: NOW + 10_000 } });
    expect(d.action === "reject" && d.reason).toContain("future");
  });
});

describe("negative: limits", () => {
  it("rejects orders exceeding the per-order bps cap of balance", () => {
    const d = decide({ mandateBalanceUsd: 1_000 }); // cap = 250bps * $1000 = $25
    expect(d.action === "reject" && d.reason).toContain("exceeds per-order cap");
  });

  it("allows orders within the cap", () => {
    expect(decide({ mandateBalanceUsd: 10_000 }).action).toBe("execute"); // cap $250
  });
});

describe("ledger lifecycle transitions (append-only)", () => {
  const happy: LedgerEventType[] = ["proposed", "validated", "submitted", "filled", "reconciled"];
  for (let i = 0; i < happy.length - 1; i++) {
    it(`allows ${happy[i]} → ${happy[i + 1]}`, () => {
      expect(isValidLedgerTransition(happy[i], happy[i + 1])).toBe(true);
    });
  }

  it("allows terminal rejection at any pre-fill stage", () => {
    for (const from of ["proposed", "validated", "submitted"] as LedgerEventType[]) {
      expect(isValidLedgerTransition(from, "rejected")).toBe(true);
    }
  });

  it("forbids rewriting history: rejected/cancelled/reconciled are terminal", () => {
    for (const from of ["rejected", "cancelled", "reconciled"] as LedgerEventType[]) {
      for (const to of ["proposed", "validated", "submitted", "filled", "cancelled", "reconciled"] as LedgerEventType[]) {
        expect(isValidLedgerTransition(from, to)).toBe(false);
      }
    }
  });

  it("forbids skipping stages (no submitted-from-nothing)", () => {
    expect(isValidLedgerTransition("proposed", "submitted")).toBe(false);
    expect(isValidLedgerTransition("validated", "reconciled")).toBe(false);
    expect(isValidLedgerTransition("proposed", "filled")).toBe(false);
  });
});
