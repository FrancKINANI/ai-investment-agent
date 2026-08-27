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
import { getAuthorityState, getPlatformApiKey, createOperatorAction, createSecurityAlert, consumeLiveOrderApproval, listWalletMandates, claimLiveOrderIntent, reserveLiveDailyRisk, updateLiveOrderIntentStatus } from "./db";
import { assertAuthorityAllows, AuthorityBlockedError } from "@shared/authorityState";
import { reconcileLiveExecution, liveOrderApprovalHash, type LegacyMandateMode } from "@shared/mandateAuthority";
import { ledgerSeq } from "@shared/paperExecution";
import { readBinanceTicker } from "./liveData";
import { getLiveOrderByIdempotencyKey, appendLedgerEvent } from "./db";
import { assertLiveVenueMutationAllowed } from "./liveExecutionBoundary";

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
  /** Required for live orders (Stage 5): duplicates return the original result, never re-submit. */
  idempotencyKey?: string;
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

function getOrderNotionalUsd(order: LiveOrderRequest): number | null {
  if (Number.isFinite(order.quoteOrderQty) && (order.quoteOrderQty ?? 0) > 0) {
    return order.quoteOrderQty!;
  }
  if (Number.isFinite(order.price) && (order.price ?? 0) > 0 && Number.isFinite(order.quantity) && (order.quantity ?? 0) > 0) {
    return order.price! * order.quantity!;
  }
  return null;
}

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
  const normalizedSymbol = order.symbol.trim().toUpperCase();
  const baseAsset = normalizedSymbol.replace(/(USDT|BUSD|USD|BTC|ETH)$/, "");
  if (mandate.allowedAssets.length > 0 && !mandate.allowedAssets.some((asset) => {
    const allowed = asset.trim().toUpperCase();
    return allowed === normalizedSymbol || allowed === baseAsset;
  })) {
    return { allowed: false, reason: `Asset "${baseAsset}" is not in the allowed assets list.`, mandateId: mandate.mandateId };
  }

  if (!Number.isFinite(accountBalanceUsd) || accountBalanceUsd <= 0) {
    return { allowed: false, reason: "A verified positive account balance is required before a live order can be evaluated.", mandateId: mandate.mandateId };
  }

  const orderValueUsd = getOrderNotionalUsd(order);
  if (orderValueUsd === null || !Number.isFinite(orderValueUsd) || orderValueUsd <= 0) {
    return { allowed: false, reason: "A verified positive USD order value is required before a live order can be evaluated.", mandateId: mandate.mandateId };
  }

  const orderBps = Math.round((orderValueUsd / accountBalanceUsd) * 10_000);

  // Check per-order limit
  if (orderBps > mandate.maxOrderBps) {
    return {
      allowed: false,
      reason: `Order value $${orderValueUsd.toFixed(2)} (${orderBps}bps) exceeds mandate max ${mandate.maxOrderBps}bps per order.`,
      mandateId: mandate.mandateId,
    };
  }

  // The aggregate cap is reserved transactionally before submission; still
  // reject a single order that would itself exceed the full daily envelope.
  if (orderBps > mandate.dailyCapBps) {
    return {
      allowed: false,
      reason: `Order value $${orderValueUsd.toFixed(2)} (${orderBps}bps) exceeds mandate daily cap ${mandate.dailyCapBps}bps.`,
      mandateId: mandate.mandateId,
    };
  }

  return { allowed: true, reason: "Order within mandate limits.", mandateId: mandate.mandateId, mode: mandate.mode };
}

function assertPlatformKeyLimits(key: { maxOrderUsd: number | null; allocatedCapitalUsd: number | null; dailyTradeLimit: number | null }, orderValueUsd: number) {
  if (!Number.isFinite(key.maxOrderUsd) || !Number.isFinite(key.allocatedCapitalUsd) || !Number.isInteger(key.dailyTradeLimit) || (key.maxOrderUsd ?? 0) <= 0 || (key.allocatedCapitalUsd ?? 0) <= 0 || (key.dailyTradeLimit ?? 0) <= 0) {
    throw new Error("Platform key must have verified positive order, allocation, and daily-trade limits before live use.");
  }
  if (orderValueUsd > key.maxOrderUsd!) {
    throw new Error(`Order value $${orderValueUsd.toFixed(2)} exceeds the platform-key maximum of $${key.maxOrderUsd!.toFixed(2)}.`);
  }
  if (orderValueUsd > key.allocatedCapitalUsd!) {
    throw new Error(`Order value $${orderValueUsd.toFixed(2)} exceeds the platform-key allocation of $${key.allocatedCapitalUsd!.toFixed(2)}.`);
  }
}

function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// ─── Live Execution ───────────────────────────────────────────────────────

/**
 * Get real balances from Binance using the stored API key.
 */
export async function getLiveBalances(userId: number, platformKeyId: string): Promise<LiveBalance[]> {
  const authorityState = await getAuthorityState(userId);
  assertAuthorityAllows(authorityState, "read-live");
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
  const authorityState = await getAuthorityState(userId);
  assertAuthorityAllows(authorityState, "read-live");
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
  // 0. Authority state machine gate (fail closed). Dominates mandate checks.
  const authorityState = await getAuthorityState(userId);
  try {
    assertAuthorityAllows(authorityState, "place-order");
  } catch (error) {
    const reason = error instanceof AuthorityBlockedError ? error.message : "Authority check failed.";
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "simulation_blocked",
      status: "blocked",
      subject: `Order blocked by authority state: ${order.symbol} ${order.side}`,
      detail: reason,
      payload: { order, authorityState, reason },
    });
    throw error;
  }

  // 0a2. Live idempotency (Stage 5) — checked BEFORE approvals/freshness so a network retry
  // of an already-submitted order never consumes a second owner approval.
  if (!order.idempotencyKey) {
    throw new AuthorityBlockedError(authorityState, "place-order", "Live orders require a caller-supplied idempotencyKey (Stage 5).");
  }
  // Even an otherwise valid request may not cross the service boundary in this
  // release. Keeping this after authority/idempotency guards preserves their
  // independent fail-closed guarantees for direct callers and tests.
  assertLiveVenueMutationAllowed();
  const duplicate = await getLiveOrderByIdempotencyKey(userId, order.idempotencyKey);
  if (duplicate) {
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "scope_checked",
      status: "review",
      subject: `Live order duplicate key suppressed: ${order.symbol} ${order.side}`,
      detail: `Idempotency key already recorded (status: ${duplicate.status}). Original outcome returned; Binance was NOT called again.`,
      payload: { order, duplicateStatus: duplicate.status },
    });
    const dupResult: LiveOrderResult = {
      orderId: duplicate.orderId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: duplicate.status,
      price: String(duplicate.outcome.price ?? ""),
      quantity: String(duplicate.outcome.origQty ?? ""),
      executedQty: String(duplicate.outcome.executedQty ?? ""),
    };
    return { result: dupResult, mandateCheck: { allowed: true, reason: "Duplicate idempotency key; original outcome returned without re-submission.", mandateId: mandate?.mandateId, mode: mandate?.mode } };
  }

  // 0b. Mandate ↔ authority reconciliation (Stage 5): both must agree.
  if (mandate) {
    const verdict = reconcileLiveExecution({
      authorityState,
      mandateMode: mandate.mode as LegacyMandateMode,
      mandateStatus: mandate.status,
    });
    if (!verdict.allowed) {
      await createOperatorAction(userId, {
        actionId: nanoid(),
        kind: "simulation_blocked",
        status: "blocked",
        subject: `Order blocked by mandate/authority disagreement: ${order.symbol} ${order.side}`,
        detail: verdict.reason,
        payload: { order, authorityState, mandateMode: mandate.mode, reason: verdict.reason },
      });
      throw new AuthorityBlockedError(authorityState, "place-order", verdict.reason);
    }
  }

  // 0b3. Market orders must carry a fresh venue price. The verified price is
  // also used to compute quantity-based notional limits; no unknown notional
  // can bypass risk checks.
  let orderForRisk = order;
  if (order.type === "MARKET") {
    const ticker = await readBinanceTicker({ symbol: order.symbol, authorityState });
    if (!ticker.ok) {
      const detail = `Live market order refused: no fresh reference price (${ticker.errorKind}: ${ticker.message}).`;
      await createOperatorAction(userId, {
        actionId: nanoid(),
        kind: "simulation_blocked",
        status: "blocked",
        subject: `Live order blocked on stale price: ${order.symbol} ${order.side}`,
        detail,
        payload: { order, errorKind: ticker.errorKind },
      });
      throw new AuthorityBlockedError(authorityState, "place-order", detail);
    }
    orderForRisk = { ...order, price: ticker.data.price };
  }

  // 1. Check mandate against fully determined notional.
  const mandateCheck = checkMandateAllowance(mandate, orderForRisk, accountBalanceUsd);
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

  // 0b2. Per-order owner approval (Stage 5): mandatory in approval-required-live.
  if (authorityState === "approval-required-live" && mandate) {
    const orderHash = liveOrderApprovalHash({
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity ?? null,
      quoteOrderQty: order.quoteOrderQty ?? null,
      price: order.price ?? null,
      idempotencyKey: order.idempotencyKey!,
    });
    const approved = await consumeLiveOrderApproval(userId, orderHash, order.idempotencyKey!);
    if (!approved) {
      const detail = `Order ${order.symbol} ${order.side} requires per-order owner approval (authority state: approval-required-live). Approve the exact order hash ${orderHash}; approval is single-use and expires in 10 minutes.`;
      await createOperatorAction(userId, {
        actionId: nanoid(),
        kind: "simulation_blocked",
        status: "blocked",
        subject: `Live order awaiting owner approval: ${order.symbol} ${order.side}`,
        detail,
        payload: { order, orderHash },
      });
      throw new AuthorityBlockedError(authorityState, "place-order", detail);
    }
  }

  // 2. Get API key
  const key = await getPlatformApiKey(userId, platformKeyId);
  if (!key) throw new Error("API key is required for live orders.");
  if (key.state !== "active") throw new Error("API key is not verified for live use.");
  const orderValueUsd = getOrderNotionalUsd(orderForRisk);
  if (orderValueUsd === null) throw new Error("A verified order value is required for live use.");
  assertPlatformKeyLimits(key, orderValueUsd);
  const notionalCentsNumber = Math.round(orderValueUsd * 100);
  const mandateDailyCentsNumber = Math.floor(accountBalanceUsd * (mandate!.dailyCapBps / 10_000) * 100);
  const keyAllocationCentsNumber = Math.floor(key.allocatedCapitalUsd! * 100);
  if (![notionalCentsNumber, mandateDailyCentsNumber, keyAllocationCentsNumber].every(Number.isSafeInteger)) {
    throw new Error("Live risk limit exceeds exact fixed-unit precision.");
  }
  const notionalCents = notionalCentsNumber;
  const mandateDailyCents = mandateDailyCentsNumber;
  const keyAllocationCents = keyAllocationCentsNumber;
  const riskReserved = await reserveLiveDailyRisk({
    userId,
    dayKey: utcDayKey(),
    notionalCents,
    maxNotionalCents: Math.min(mandateDailyCents, keyAllocationCents),
    maxTradeCount: key.dailyTradeLimit!,
  });
  if (!riskReserved) {
    const detail = "Live order refused because the atomic daily risk budget or trade-count limit is exhausted.";
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "simulation_blocked",
      status: "blocked",
      subject: `Live order blocked by daily risk budget: ${order.symbol} ${order.side}`,
      detail,
      payload: { order, accountBalanceUsd, dailyTradeLimit: key.dailyTradeLimit },
    });
    throw new Error(detail);
  }

  // Acquire the durable unique reservation immediately before the first
  // submission record or venue request. A racing caller cannot acquire it.
  const orderHash = liveOrderApprovalHash({
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity ?? null,
    quoteOrderQty: order.quoteOrderQty ?? null,
    price: order.price ?? null,
    idempotencyKey: order.idempotencyKey!,
  });
  const intent = await claimLiveOrderIntent(userId, order.idempotencyKey!, orderHash);
  if (!intent.claimed) {
    const detail = `Live order idempotency key is already reserved (${intent.status}); Binance was not called again.`;
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "scope_checked",
      status: "review",
      subject: `Live order duplicate reservation suppressed: ${order.symbol} ${order.side}`,
      detail,
      payload: { order, intentStatus: intent.status },
    });
    return {
      result: { orderId: 0, symbol: order.symbol, side: order.side, type: order.type, status: "submitted-unknown-outcome", price: "", quantity: "", executedQty: "" },
      mandateCheck: { ...mandateCheck, reason: detail },
    };
  }

  const clientOrderId = `ll-${nanoid(12)}`;
  // Ledger: submitted (request snapshot) before any venue call — append-only.
  await appendLedgerEvent(userId, {
    orderId: order.idempotencyKey,
    idempotencyKey: order.idempotencyKey,
    venue: "binance",
    executionMode: "live",
    symbol: order.symbol,
    side: order.side,
    orderType: order.type,
    quantity: order.quantity?.toString() ?? null,
    price: order.price?.toString() ?? null,
    quoteOrderQty: order.quoteOrderQty?.toString() ?? null,
    seq: ledgerSeq("submitted"),
    eventType: "submitted",
    payload: { clientOrderId, mandateId: mandateCheck.mandateId ?? null },
    mandateId: mandateCheck.mandateId ?? null,
  });
  await updateLiveOrderIntentStatus(userId, order.idempotencyKey!, "submitted");

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
  let response;
  try {
    response = await binancePlaceOrder(apiKey, apiSecret, {
      symbol: order.symbol,
      side: order.side as BinanceOrderSide,
      type: order.type as BinanceOrderType,
      quantity: order.quantity?.toString(),
      quoteOrderQty: order.quoteOrderQty?.toString(),
      price: order.price?.toString(),
      timeInForce: order.timeInForce as BinanceTimeInForce,
      newClientOrderId: clientOrderId,
    });
  } catch (error) {
    // Reconciliation: venue call failed after submission intent was recorded.
    await appendLedgerEvent(userId, {
      orderId: order.idempotencyKey!,
      idempotencyKey: order.idempotencyKey!,
      venue: "binance",
      executionMode: "live",
      symbol: order.symbol,
      side: order.side,
      orderType: order.type,
      seq: ledgerSeq("rejected"),
      eventType: "rejected",
      payload: { clientOrderId, outcome: { status: "REJECTED", reason: error instanceof Error ? error.message : "unknown" } },
      mandateId: mandateCheck.mandateId ?? null,
    });
    await updateLiveOrderIntentStatus(userId, order.idempotencyKey!, "rejected");
    throw error;
  }
  // Reconciliation: record the authoritative venue outcome.
  await appendLedgerEvent(userId, {
    orderId: order.idempotencyKey!,
    idempotencyKey: order.idempotencyKey!,
    venue: "binance",
    executionMode: "live",
    symbol: order.symbol,
    side: order.side,
    orderType: order.type,
    quantity: order.quantity?.toString() ?? null,
    price: order.price?.toString() ?? null,
    quoteOrderQty: order.quoteOrderQty?.toString() ?? null,
    seq: response.status === "REJECTED" ? ledgerSeq("rejected") : ledgerSeq("filled"),
    eventType: response.status === "REJECTED" ? "rejected" : "filled",
    payload: { clientOrderId, outcome: { orderId: response.orderId, status: response.status, price: response.price, origQty: response.origQty, executedQty: response.cummulativeQuoteQty } },
    mandateId: mandateCheck.mandateId ?? null,
  });
  await updateLiveOrderIntentStatus(userId, order.idempotencyKey!, response.status === "REJECTED" ? "rejected" : "filled");

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
  // Cancellation is a signed Binance mutation. It follows the same global
  // authority and mandate reconciliation as placement so paused/revoked
  // authority dominates every venue-side effect.
  const authorityState = await getAuthorityState(userId);
  const mandate = (await listWalletMandates(userId)).find(
    (candidate) => candidate.venue === "binance" && candidate.status === "active",
  ) ?? null;

  try {
    assertAuthorityAllows(authorityState, "cancel-order");
    if (!mandate) {
      throw new AuthorityBlockedError(authorityState, "cancel-order", "No active Binance mandate permits order cancellation.");
    }
    const verdict = reconcileLiveExecution({
      authorityState,
      mandateMode: mandate.mode as LegacyMandateMode,
      mandateStatus: mandate.status,
    });
    if (!verdict.allowed) {
      throw new AuthorityBlockedError(authorityState, "cancel-order", verdict.reason);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Authority check failed.";
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "simulation_blocked",
      status: "blocked",
      subject: `Order cancellation blocked: ${symbol} #${orderId}`,
      detail: reason,
      payload: { symbol, orderId, authorityState, mandateId: mandate?.mandateId ?? null, reason },
    });
    throw error;
  }

  // No decryption or venue request is permitted in the sealed release.
  assertLiveVenueMutationAllowed();

  const key = await getPlatformApiKey(userId, platformKeyId);
  if (!key) throw new Error("API key not found.");
  if (key.state !== "active") throw new Error("API key is disabled.");

  const apiKey = decryptSecret(key.apiKeyEncrypted);
  const apiSecret = decryptSecret(key.secretEncrypted);
  const result = await binanceCancelOrder(apiKey, apiSecret, symbol, orderId);

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "scope_checked",
    status: "success",
    subject: `Order cancelled: ${symbol} #${orderId}`,
    detail: `Owner cancelled a live order on Binance after authority and mandate validation.`,
    payload: { symbol, orderId, result, authorityState, mandateId: mandate.mandateId },
  });

  return result;
}
