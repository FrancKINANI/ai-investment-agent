import { afterEach, describe, expect, it, vi } from "vitest";
import { getEthereumTokenMetrics } from "./onchain";

const weth = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

afterEach(() => vi.unstubAllGlobals());

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
});
