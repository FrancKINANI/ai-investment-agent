const ETHEREUM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

type BlockscoutToken = {
  address_hash: string;
  name: string;
  symbol: string;
  decimals: string;
  holders_count: string;
  exchange_rate: string | null;
  volume_24h: string | null;
  circulating_market_cap: string | null;
};

type DexPair = {
  pairAddress: string;
  dexId: string;
  priceUsd: string | null;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  url?: string;
};

function numberOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getEthereumTokenMetrics(address: string) {
  if (!ETHEREUM_ADDRESS.test(address)) throw new Error("A valid Ethereum token contract address is required.");
  const normalized = address.toLowerCase();
  const explorerUrl = `https://eth.blockscout.com/api/v2/tokens/${normalized}`;
  const dexUrl = `https://api.dexscreener.com/token-pairs/v1/ethereum/${normalized}`;
  const [explorerResult, dexResult] = await Promise.allSettled([
    fetch(explorerUrl, { headers: { Accept: "application/json" } }),
    fetch(dexUrl, { headers: { Accept: "application/json" } }),
  ]);

  if (explorerResult.status !== "fulfilled" || !explorerResult.value.ok) {
    throw new Error("Blockscout public API is unavailable for this token at the moment.");
  }
  const token = await explorerResult.value.json() as BlockscoutToken;
  let bestPair: DexPair | null = null;
  if (dexResult.status === "fulfilled" && dexResult.value.ok) {
    const pairs = await dexResult.value.json() as DexPair[];
    bestPair = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
  }

  return {
    token: {
      address: token.address_hash,
      name: token.name,
      symbol: token.symbol,
      decimals: Number(token.decimals),
      holders: numberOrNull(token.holders_count),
      explorerPriceUsd: numberOrNull(token.exchange_rate),
      explorerVolume24h: numberOrNull(token.volume_24h),
      marketCap: numberOrNull(token.circulating_market_cap),
    },
    market: bestPair ? {
      priceUsd: numberOrNull(bestPair.priceUsd),
      liquidityUsd: numberOrNull(bestPair.liquidity?.usd),
      volume24h: numberOrNull(bestPair.volume?.h24),
      priceChange24h: numberOrNull(bestPair.priceChange?.h24),
      dex: bestPair.dexId,
      pairAddress: bestPair.pairAddress,
      sourceUrl: bestPair.url ?? null,
    } : null,
    scopes: ["chain.read", "market.read"],
    authority: "public read-only endpoints; no wallet, signature, exchange, or execution scope",
    sources: { explorer: "Blockscout public API", market: bestPair ? "DexScreener public API" : "unavailable" },
    fetchedAt: Date.now(),
  };
}
