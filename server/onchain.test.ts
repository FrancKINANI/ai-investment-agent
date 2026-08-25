import { afterEach, describe, expect, it, vi } from "vitest";
import { getEthereumTokenMetrics, resetTokenMetricCache } from "./onchain";

const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

afterEach(() => { vi.unstubAllGlobals(); resetTokenMetricCache(); });

describe("getEthereumTokenMetrics", () => {
  it("rejects invalid contract addresses before any network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(getEthereumTokenMetrics("not-an-address")).rejects.toThrow("valid Ethereum token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("combines public explorer metadata with the deepest public DEX pair", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ address_hash: weth, name: "Wrapped Ether", symbol: "WETH", decimals: "18", holders_count: "9", exchange_rate: "2000.12", volume_24h: "90", circulating_market_cap: "100" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { pairAddress: "low", dexId: "alpha", priceUsd: "2001", liquidity: { usd: 10 }, volume: { h24: 20 }, priceChange: { h24: 1 } },
        { pairAddress: "deep", dexId: "beta", priceUsd: "2002", liquidity: { usd: 40 }, volume: { h24: 30 }, priceChange: { h24: 2 } },
      ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getEthereumTokenMetrics(weth);
    expect(result.token.symbol).toBe("WETH");
    expect(result.market?.pairAddress).toBe("deep");
    expect(result.market?.priceUsd).toBe(2002);
    expect(result.scopes).toEqual(["chain.read", "market.read"]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it("keeps chain metadata but marks market data unavailable when the DEX source fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ address_hash: weth, name: "Wrapped Ether", symbol: "WETH", decimals: "18", holders_count: "9", exchange_rate: "2000.12", volume_24h: "90", circulating_market_cap: "100" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("upstream unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getEthereumTokenMetrics(weth);
    expect(result.token.name).toBe("Wrapped Ether");
    expect(result.market).toBeNull();
    expect(result.sources.market).toBe("unavailable");
  });

  it("returns a bounded fresh cache entry without repeating public upstream calls", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ address_hash: weth, name: "Wrapped Ether", symbol: "WETH", decimals: "18", holders_count: "9", exchange_rate: "2000.12", volume_24h: "90", circulating_market_cap: "100" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await getEthereumTokenMetrics(weth);
    const second = await getEthereumTokenMetrics(weth.toLowerCase());
    expect(first.freshness).toBe("live");
    expect(second.freshness).toBe("cached");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed explorer payloads and treats malformed DEX payloads as unavailable", async () => {
    const malformedExplorer = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ address_hash: weth }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", malformedExplorer);
    await expect(getEthereumTokenMetrics(weth)).rejects.toThrow("unexpected token response");

    resetTokenMetricCache();
    const malformedDex = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ address_hash: weth, name: "Wrapped Ether", symbol: "WETH", decimals: "18", holders_count: "9", exchange_rate: null, volume_24h: null, circulating_market_cap: null }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ pairs: "not-an-array" }), { status: 200 }));
    vi.stubGlobal("fetch", malformedDex);
    const result = await getEthereumTokenMetrics(weth);
    expect(result.market).toBeNull();
    expect(JSON.stringify(result)).not.toContain("sourceUrl");
  });
});
