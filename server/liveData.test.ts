import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  BinanceTickerSchema,
  DEFAULT_RATE_LIMIT,
  isFresh,
  readBinanceTicker,
  readLiveData,
  resetRateLimits,
  tryTakeToken,
} from "./liveData";
import type { AuthorityState } from "@shared/authorityState";

const NOW = 1_700_000_000_000;

function okFetch(body: unknown, delayMs = 0): typeof fetch {
  return vi.fn(async (_url, init?: RequestInit) => {
    if (delayMs) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delayMs);
        init?.signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); });
      });
    }
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
}

function statusFetch(status: number): typeof fetch {
  return vi.fn(async () => new Response("err", { status })) as unknown as typeof fetch;
}

beforeEach(() => resetRateLimits());

describe("authority gating (no network for blocked states)", () => {
  it.each(["disabled", "sandbox-only", "paused", "revoked"] as AuthorityState[])(
    "never calls upstream in state %s",
    async (state) => {
      const f = okFetch({ symbol: "BTCUSDT", price: "50000" });
      const r = await readBinanceTicker({ symbol: "BTCUSDT", authorityState: state, fetchImpl: f });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errorKind).toBe("authority-blocked");
        expect(r.message).toContain(state);
      }
      expect(f).not.toHaveBeenCalled();
    },
  );

  it.each(["read-only-live", "approval-required-live", "limited-live"] as AuthorityState[])(
    "allows reads in state %s",
    async (state) => {
      const r = await readBinanceTicker({ symbol: "BTCUSDT", authorityState: state, fetchImpl: okFetch({ symbol: "BTCUSDT", price: "50000" }) });
      expect(r.ok).toBe(true);
    },
  );
});

describe("truthful success envelopes with freshness metadata", () => {
  it("returns validated data plus source/timestamp/latency", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    try {
      const r = await readBinanceTicker({ symbol: "btcusdt", authorityState: "read-only-live", fetchImpl: okFetch({ symbol: "BTCUSDT", price: "51000.5" }) });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.price).toBe(51000.5); // string coerced by strict schema only after validation
        expect(r.data.symbol).toBe("BTCUSDT");
        expect(r.source).toContain("binance");
        expect(r.fetchedAtMs).toBe(NOW);
        expect(typeof r.latencyMs).toBe("number");
        expect(isFresh(r, 60_000, NOW + 1_000)).toBe(true);
        expect(isFresh(r, 60_000, NOW + 61_000)).toBe(false);
      }
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("negative failure modes", () => {
  it("fails closed on schema drift instead of trusting the shape", async () => {
    const r = await readBinanceTicker({ symbol: "BTCUSDT", authorityState: "read-only-live", fetchImpl: okFetch({ sym: "BTCUSDT", price: null }) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKind).toBe("schema");
  });

  it("reports HTTP errors truthfully as network failures with status", async () => {
    const r = await readBinanceTicker({ symbol: "BTCUSDT", authorityState: "read-only-live", fetchImpl: statusFetch(418) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorKind).toBe("network");
      expect(r.message).toContain("418");
    }
  });

  it("enforces hard timeouts", async () => {
    const r = await readLiveData({
      source: "test:slow",
      venueKey: "test-venue",
      authorityState: "read-only-live",
      url: "https://example.test/slow",
      schema: z.object({ a: z.number() }),
      timeoutMs: 50,
      fetchImpl: okFetch({ a: 1 }, 500),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorKind).toBe("timeout");
  }, 2_000);

  it("rate-limits before hitting the network", async () => {
    const f = okFetch({ symbol: "BTCUSDT", price: "1" });
    // Drain the default bucket.
    for (let i = 0; i < DEFAULT_RATE_LIMIT.capacity; i++) {
      const r = await readBinanceTicker({ symbol: "BTCUSDT", authorityState: "read-only-live", fetchImpl: f });
      expect(r.ok).toBe(true);
    }
    const r = await readBinanceTicker({ symbol: "BTCUSDT", authorityState: "read-only-live", fetchImpl: f });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorKind).toBe("rate-limited");
      expect(f).toHaveBeenCalledTimes(DEFAULT_RATE_LIMIT.capacity); // no extra call
    }
  });

  it("tryTakeToken refills over time deterministically", () => {
    resetRateLimits();
    const t0 = NOW;
    for (let i = 0; i < DEFAULT_RATE_LIMIT.capacity; i++) expect(tryTakeToken("v", t0)).toBe(true);
    expect(tryTakeToken("v", t0)).toBe(false);
    // refillPerSecond=2 → one token after 500ms
    expect(tryTakeToken("v", t0 + 400)).toBe(false);
    expect(tryTakeToken("v", t0 + 600)).toBe(true);
  });
});

describe("BinanceTickerSchema strictness", () => {
  it("accepts valid ticker and coerces numeric string", () => {
    expect(BinanceTickerSchema.parse({ symbol: "ETHUSDT", price: "3000.25" }).price).toBe(3000.25);
  });

  it("rejects non-numeric prices outright", () => {
    expect(() => BinanceTickerSchema.parse({ symbol: "ETHUSDT", price: "NaN" })).toThrow();
    expect(() => BinanceTickerSchema.parse({ symbol: "ETHUSDT", price: "" })).toThrow();
  });
});
