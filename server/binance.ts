/**
 * Binance REST API service.
 *
 * Security boundary: this module signs requests with HMAC-SHA256 but never
 * stores raw API secrets in memory longer than a single request. Secrets
 * are decrypted from the platformApiKeys table on demand and discarded.
 *
 * ponytail: production deployment must use a KMS for secret decryption.
 * The current base64 placeholder in encryptSecret() is not secure.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ─── Configuration ────────────────────────────────────────────────────────

const BASE_URL = "https://api.binance.com";
const TESTNET_URL = "https://testnet.binance.vision";
const REQUEST_TIMEOUT_MS = 10_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 1_200; // Binance allows 1200 req/min

// ─── Types ────────────────────────────────────────────────────────────────

export type BinanceOrderSide = "BUY" | "SELL";
export type BinanceOrderType = "LIMIT" | "MARKET" | "STOP_LOSS" | "STOP_LOSS_LIMIT" | "TAKE_PROFIT" | "TAKE_PROFIT_LIMIT";
export type BinanceTimeInForce = "GTC" | "IOC" | "FOK";

export type BinanceAccountInfo = {
  makerCommission: number;
  takerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: Array<{ asset: string; free: string; locked: string }>;
};

export type BinanceTicker = {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
};

export type BinanceOrderResponse = {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  type: string;
  side: string;
};

export type BinanceExchangeInfo = {
  symbols: Array<{
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    status: string;
    filters: Array<{ filterType: string; [key: string]: string }>;
  }>;
};

// ─── Rate Limiter ─────────────────────────────────────────────────────────

const requestTimestamps: number[] = [];

function checkRateLimit() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw new Error("Binance rate limit exceeded. Try again later.");
  }
  requestTimestamps.push(now);
}

// ─── HMAC Signing ─────────────────────────────────────────────────────────

function sign(queryString: string, secret: string): string {
  return createHmac("sha256", secret).update(queryString).digest("hex");
}

function verifySignature(queryString: string, signature: string, secret: string): boolean {
  const expected = sign(queryString, secret);
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

// ─── Request Helpers ──────────────────────────────────────────────────────

function buildQueryString(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function signedRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  checkRateLimit();

  const timestamp = Date.now();
  const recvWindow = 5000;
  const allParams = { ...params, timestamp, recvWindow };
  const queryString = buildQueryString(allParams);
  const signature = sign(queryString, apiSecret);

  const url = `${BASE_URL}${path}?${queryString}&signature=${signature}`;

  const response = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = (body as { msg?: string }).msg ?? `Binance API error: ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<T>;
}

async function publicRequest<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  checkRateLimit();

  const queryString = buildQueryString(params);
  const url = `${BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = (body as { msg?: string }).msg ?? `Binance API error: ${response.status}`;
    throw new Error(msg);
  }

  return response.json() as Promise<T>;
}

// ─── Public Endpoints (no auth needed) ────────────────────────────────────

/** Get current price for a symbol. */
export async function getPrice(symbol: string): Promise<{ symbol: string; price: number }> {
  const data = await publicRequest<{ symbol: string; price: string }>("/api/v3/ticker/price", { symbol });
  return { symbol: data.symbol, price: Number(data.price) };
}

/** Get 24h ticker for a symbol. */
export async function get24hTicker(symbol: string): Promise<BinanceTicker> {
  return publicRequest<BinanceTicker>("/api/v3/ticker/24hr", { symbol });
}

/** Get exchange info (symbol rules, filters, status). */
export async function getExchangeInfo(): Promise<BinanceExchangeInfo> {
  return publicRequest<BinanceExchangeInfo>("/api/v3/exchangeInfo");
}

/** Get klines (candlestick) data. */
export async function getKlines(
  symbol: string,
  interval: string = "1h",
  limit: number = 100,
): Promise<Array<[number, string, string, string, string, string, number, string, number, string, string, string]>> {
  return publicRequest(`/api/v3/klines`, { symbol, interval, limit: String(limit) });
}

// ─── Signed Endpoints (auth required) ─────────────────────────────────────

/** Get account info including balances. */
export async function getAccount(apiKey: string, apiSecret: string): Promise<BinanceAccountInfo> {
  return signedRequest<BinanceAccountInfo>("GET", "/api/v3/account", apiKey, apiSecret);
}

/** Get non-zero balances only. */
export async function getBalances(apiKey: string, apiSecret: string) {
  const account = await getAccount(apiKey, apiSecret);
  return account.balances
    .filter((b) => Number(b.free) > 0 || Number(b.locked) > 0)
    .map((b) => ({
      asset: b.asset,
      free: Number(b.free),
      locked: Number(b.locked),
      total: Number(b.free) + Number(b.locked),
    }));
}

/** Get open orders for a symbol (or all if no symbol). */
export async function getOpenOrders(apiKey: string, apiSecret: string, symbol?: string) {
  return signedRequest<Array<{
    symbol: string;
    orderId: number;
    clientOrderId: string;
    price: string;
    origQty: string;
    executedQty: string;
    status: string;
    type: string;
    side: string;
    time: number;
  }>>("GET", "/api/v3/openOrders", apiKey, apiSecret, symbol ? { symbol } : {});
}

/** Place a new order. */
export async function placeOrder(
  apiKey: string,
  apiSecret: string,
  params: {
    symbol: string;
    side: BinanceOrderSide;
    type: BinanceOrderType;
    quantity?: string;
    quoteOrderQty?: string;
    price?: string;
    timeInForce?: BinanceTimeInForce;
    newClientOrderId?: string;
  },
): Promise<BinanceOrderResponse> {
  return signedRequest<BinanceOrderResponse>("POST", "/api/v3/order", apiKey, apiSecret, {
    symbol: params.symbol,
    side: params.side,
    type: params.type,
    quantity: params.quantity,
    quoteOrderQty: params.quoteOrderQty,
    price: params.price,
    timeInForce: params.timeInForce,
    newClientOrderId: params.newClientOrderId,
  });
}

/** Cancel an open order. */
export async function cancelOrder(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  orderId: number,
) {
  return signedRequest("DELETE", "/api/v3/order", apiKey, apiSecret, { symbol, orderId });
}

/** Get trade history for a symbol. */
export async function getTradeHistory(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  limit: number = 50,
) {
  return signedRequest<Array<{
    symbol: string;
    id: number;
    orderId: number;
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
    time: number;
    isBuyer: boolean;
    isMaker: boolean;
  }>>("GET", "/api/v3/myTrades", apiKey, apiSecret, { symbol, limit });
}

// ─── Utility ──────────────────────────────────────────────────────────────

/** Decrypt a secret from the platformApiKeys table. */
export function decryptSecret(encrypted: string): string {
  // ponytail: base64 placeholder, replace with real AES-256-GCM via KMS
  return Buffer.from(encrypted, "base64").toString();
}

/** Validate that a symbol is valid on Binance. */
export async function validateSymbol(symbol: string): Promise<boolean> {
  const info = await getExchangeInfo();
  return info.symbols.some((s) => s.symbol === symbol && s.status === "TRADING");
}
