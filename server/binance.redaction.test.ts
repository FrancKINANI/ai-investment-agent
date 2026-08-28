import { afterEach, describe, expect, it, vi } from "vitest";
import { BinanceApiError, getAccount, getPrice } from "./binance";

describe("Binance API error redaction", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not expose an upstream public-endpoint response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "apiKey=leaked&signature=leaked" }), { status: 400 })));

    await expect(getPrice("BTCUSDT")).rejects.toMatchObject<Partial<BinanceApiError>>({ code: "BINANCE_UPSTREAM_REJECTED" });
    await expect(getPrice("BTCUSDT")).rejects.not.toThrow(/leaked|apiKey|signature/i);
  });

  it("does not expose an upstream signed-endpoint response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "secret=leaked&signature=leaked" }), { status: 403 })));

    await expect(getAccount("test-key", "test-secret")).rejects.toMatchObject<Partial<BinanceApiError>>({ code: "BINANCE_AUTH_FAILED" });
    await expect(getAccount("test-key", "test-secret")).rejects.not.toThrow(/leaked|test-secret|signature/i);
  });

  it("normalizes transport errors without retaining a signed request URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("https://api.binance.com/?signature=leaked")));

    await expect(getAccount("test-key", "test-secret")).rejects.toMatchObject<Partial<BinanceApiError>>({ code: "BINANCE_UPSTREAM_UNAVAILABLE" });
    await expect(getAccount("test-key", "test-secret")).rejects.not.toThrow(/leaked|test-secret|signature/i);
  });
});
