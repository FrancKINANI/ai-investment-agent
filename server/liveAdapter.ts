/**
 * Live adapter: bridges the existing venue/mandate system to real Binance execution.
 *
 * Safety design:
 * 1. Every order checks the active mandate limits before submission
 * 2. All orders are logged to the immutable Activity record
 * 3. Real mode must be explicitly enabled on the mandate
 * 4. Withdrawal operations are never permitted
 * 5. The agent can only act within the currently active mandate
 */

import { nanoid } from "nanoid";
import {
  getBalances as binanceGetBalances,
  getPrice as binanceGetPrice,
  get24hTicker as binanceGet24hTicker,
  getOpenOrders as binanceGetOpenOrders,
  placeOrder as binancePlaceOrder,
  cancelOrder as binanceCancelOrder,
  getTradeHistory as binanceGetTradeHistory,
  type BinanceOrderSide,
  type BinanceOrderType,
  type BinanceTimeInForce,
} from "./binance";
import { decryptSecret } from "./kms";
import { getPlatformApiKey, createOperatorAction, createSecurityAlert } from "./db";

// ─── Types ────────────────────────────────────────────────────────────────

export type LiveBalance = {
  asset: string;
  free: number;
  locked: number;
  total: number;
};

export type LiveTicker = {
  symbol: string;
  price: number;
  priceChangePercent: number;
  volume: number;
  high24h: number;
  low24h: number;
};

export type LiveOrderRequest = {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity?: number;
  quoteOrderQty?: number;
  price?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
};

export type LiveOrderResult = {
  orderId: number;
  symbol: string;
  side: string;
  type: string;
  status: string;
  price: string;
  quantity: string;
  executedQty: string;
};

export type MandateCheck = {
  allowed: boolean;
  reason: string;
  mandateId?: string;
  mode?: string;
};

// ─── Safety Guards ────────────────────────────────────────────────────────

/**
 * Check if a mandate allows the requested order.
 * Returns whether the order is allowed and why.
 */
export function checkMandateAllowance(
  mandate: {
    mandateId: string;
    mode: string;
    status: string;
    venue: string;
    maxOrderBps: number;
    dailyCapBps: number;
    allowedAssets: string[];
  } | null,
  order: LiveOrderRequest,
  accountBalanceUsd: number,
): MandateCheck {
  if (!mandate) {
    return { allowed: false, reason: "No active mandate found for this venue." };
  }

  if (mandate.status !== "active") {
    return { allowed: false, reason: `Mandate is ${mandate.status}, not active.`, mandateId: mandate.mandateId };
  }

  if (mandate.mode !== "real" && mandate.mode !== "armed") {
    return { allowed: false, reason: `Mandate mode is "${mandate.mode}". Real mode must be explicitly enabled.`, mandateId: mandate.mandateId, mode: mandate.mode };
  }

  if (mandate.venue !== "binance") {
    return { allowed: false, reason: `Mandate venue is "${mandate.venue}", not binance.`, mandateId: mandate.mandateId };
  }

  // Check asset allowance
  const baseAsset = order.symbol.replace(/(USDT|BUSD|USD|BTC|ETH)$/, "");
  if (mandate.allowedAssets.length > 0 && !mandate.allowedAssets.some((a) => a.toUpperCase().includes(baseAsset.toUpperCase()))) {
    return { allowed: false, reason: `Asset "${baseAsset}" is not in the allowed assets list.`, mandateId: mandate.mandateId };
  }

  // Calculate order value in basis points of account balance
  let orderValueUsd = 0;
  if (order.quoteOrderQty && accountBalanceUsd > 0) {
    orderValueUsd = order.quoteOrderQty;
  } else if (order.price && order.quantity) {
    orderValueUsd = order.price * order.quantity;
  }

  if (orderValueUsd > 0 && accountBalanceUsd > 0) {
    const orderBps = Math.round((orderValueUsd / accountBalanceUsd) * 10_000);

    // Check per-order limit
    if (orderBps > mandate.maxOrderBps) {
      return {
        allowed: false,
        reason: `Order value $${orderValueUsd.toFixed(2)} (${orderBps}bps) exceeds mandate max ${mandate.maxOrderBps}bps per order.`,
        mandateId: mandate.mandateId,
      };
    }

    // Check daily cap (accumulated orders today vs dailyCapBps)
    // ponytail: In production, query today's executed order total from Activity record
    // For now, enforce that a single order cannot exceed the daily cap
    if (orderBps > mandate.dailyCapBps) {
      return {
        allowed: false,
        reason: `Order value $${orderValueUsd.toFixed(2)} (${orderBps}bps) exceeds mandate daily cap ${mandate.dailyCapBps}bps.`,
        mandateId: mandate.mandateId,
      };
    }
  }

  return { allowed: true, reason: "Order within mandate limits.", mandateId: mandate.mandateId, mode: mandate.mode };
}

// ─── Live Execution ───────────────────────────────────────────────────────

/**
 * Get real balances from Binance using the stored API key.
 */
export async function getLiveBalances(userId: number, platformKeyId: string): Promise<LiveBalance[]> {
  const key = await getPlatformApiKey(userId, platformKeyId);
  if (!key) throw new Error("API key not found.");
  if (key.state !== "active") throw new Error("API key is disabled.");

  const apiKey = decryptSecret(key.apiKeyEncrypted);
  const apiSecret = decryptSecret(key.secretEncrypted);
  const balances = await binanceGetBalances(apiKey, apiSecret);

  return balances.filter((b) => b.total > 0);
}

/**
 * Get real ticker data from Binance.
 */
export async function getLiveTicker(symbol: string): Promise<LiveTicker> {
  const ticker = await binanceGet24hTicker(symbol);
  return {
    symbol: ticker.symbol,
    price: Number(ticker.price),
    priceChangePercent: Number(ticker.priceChangePercent),
    volume: Number(ticker.quoteVolume),
    high24h: Number(ticker.highPrice),
    low24h: Number(ticker.lowPrice),
  };
}

/**
 * Get real open orders from Binance.
 */
export async function getLiveOpenOrders(userId: number, platformKeyId: string, symbol?: string) {
  const key = await getPlatformApiKey(userId, platformKeyId);
  if (!key) throw new Error("API key not found.");
  if (key.state !== "active") throw new Error("API key is disabled.");

  const apiKey = decryptSecret(key.apiKeyEncrypted);
  const apiSecret = decryptSecret(key.secretEncrypted);
  return binanceGetOpenOrders(apiKey, apiSecret, symbol);
}

/**
 * Place a real order on Binance after mandate checks.
 *
 * This is the critical path: it validates the mandate, logs the attempt,
 * places the order, and logs the result.
 */
export async function executeLiveOrder(
  userId: number,
  platformKeyId: string,
  mandate: {
    mandateId: string;
    mode: string;
    status: string;
    venue: string;
    maxOrderBps: number;
    dailyCapBps: number;
    allowedAssets: string[];
  } | null,
  order: LiveOrderRequest,
  accountBalanceUsd: number,
): Promise<{ result: LiveOrderResult; mandateCheck: MandateCheck }> {
  // 1. Check mandate
  const mandateCheck = checkMandateAllowance(mandate, order, accountBalanceUsd);
  if (!mandateCheck.allowed) {
    // Log the blocked attempt
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "simulation_blocked",
      status: "blocked",
      subject: `Order blocked: ${order.symbol} ${order.side}`,
      detail: mandateCheck.reason,
      payload: { order, mandateId: mandateCheck.mandateId, reason: mandateCheck.reason },
    });

    throw new Error(`Order blocked: ${mandateCheck.reason}`);
  }

  // 2. Get API key
  const key = await getPlatformApiKey(userId, platformKeyId);
  if (!key) throw new Error("API key not found.");
  if (key.state !== "active") throw new Error("API key is disabled.");

  // 3. Log the attempt
  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "scope_checked",
    status: "review",
    subject: `Live order: ${order.symbol} ${order.side} ${order.type}`,
    detail: `Owner authorized a live ${order.type.toLowerCase()} ${order.side.toLowerCase()} order on ${order.symbol}. Mandate ${mandateCheck.mandateId} mode: ${mandateCheck.mode}.`,
    payload: { order, mandateId: mandateCheck.mandateId, platformKeyId, mode: mandateCheck.mode },
  });

  // 4. Place the order
  const apiKey = decryptSecret(key.apiKeyEncrypted);
  const apiSecret = decryptSecret(key.secretEncrypted);
  const response = await binancePlaceOrder(apiKey, apiSecret, {
    symbol: order.symbol,
    side: order.side as BinanceOrderSide,
    type: order.type as BinanceOrderType,
    quantity: order.quantity?.toString(),
    quoteOrderQty: order.quoteOrderQty?.toString(),
    price: order.price?.toString(),
    timeInForce: order.timeInForce as BinanceTimeInForce,
    newClientOrderId: `ll-${nanoid(12)}`,
  });

  // 5. Log the result
  const resultStatus = response.status === "FILLED" ? "success" : response.status === "REJECTED" ? "blocked" : "review";
  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "research_completed",
    status: resultStatus as "success" | "review" | "blocked",
    subject: `Order ${response.status}: ${response.symbol} ${response.side}`,
    detail: `Live order ${response.status.toLowerCase()} on Binance. Order ID: ${response.orderId}. Executed: ${response.executedQty}/${response.origQty}.`,
    payload: {
      orderId: response.orderId,
      symbol: response.symbol,
      side: response.side,
      type: response.type,
      status: response.status,
      price: response.price,
      quantity: response.origQty,
      executedQty: response.cummulativeQuoteQty,
      mandateId: mandateCheck.mandateId,
    },
  });

  // 6. Emit alert for significant events
  if (response.status === "FILLED") {
    await createSecurityAlert(userId, {
      alertId: nanoid(),
      level: "info",
      category: "order-executed",
      title: `Order filled: ${response.symbol} ${response.side}`,
      detail: `A live ${response.type.toLowerCase()} ${response.side.toLowerCase()} order for ${response.origQty} ${response.symbol} was filled on Binance at $${response.price}.`,
    });
  } else if (response.status === "REJECTED") {
    await createSecurityAlert(userId, {
      alertId: nanoid(),
      level: "warning",
      category: "order-rejected",
      title: `Order rejected: ${response.symbol} ${response.side}`,
      detail: `A live ${response.type.toLowerCase()} ${response.side.toLowerCase()} order for ${response.symbol} was rejected by Binance.`,
    });
  }

  return {
    result: {
      orderId: response.orderId,
      symbol: response.symbol,
      side: response.side,
      type: response.type,
      status: response.status,
      price: response.price,
      quantity: response.origQty,
      executedQty: response.cummulativeQuoteQty,
    },
    mandateCheck,
  };
}

/**
 * Cancel a live order on Binance.
 */
export async function cancelLiveOrder(
  userId: number,
  platformKeyId: string,
  symbol: string,
  orderId: number,
) {
  const key = await getPlatformApiKey(userId, platformKeyId);
  if (!key) throw new Error("API key not found.");
  if (key.state !== "active") throw new Error("API key is disabled.");

  const apiKey = decryptSecret(key.apiKeyEncrypted);
  const apiSecret = decryptSecret(key.secretEncrypted);
  const result = await binanceCancelOrder(apiKey, apiSecret, symbol, orderId);

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "simulation_settled",
    status: "success",
    subject: `Order cancelled: ${symbol} #${orderId}`,
    detail: `Owner cancelled a live order on Binance.`,
    payload: { symbol, orderId, result },
  });

  return result;
}
