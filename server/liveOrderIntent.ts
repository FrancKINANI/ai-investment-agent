import { nanoid } from "nanoid";
import type { AuthorityState } from "@shared/authorityState";

const MAX_BALANCE_SNAPSHOT_AGE_MS = 60_000;
const CANONICAL_BINANCE_SYMBOL = /^[A-Z0-9]{3,20}$/;
const RESERVED_SYMBOLS = new Set(["UNKNOWN", "TEST", "PLACEHOLDER", "NONE", "N/A"]);
const BINANCE_SIDES = new Set<ServerDerivedLiveOrderIntent["order"]["side"]>(["BUY", "SELL"]);
const BINANCE_ORDER_TYPES = new Set<ServerDerivedLiveOrderIntent["order"]["type"]>(["MARKET", "LIMIT"]);
const BINANCE_TIME_IN_FORCE = new Set<ServerDerivedLiveOrderIntent["order"]["timeInForce"]>(["GTC", "IOC", "FOK"]);

export type VerifiedBalanceSnapshot = {
  availableUsd: number;
  source: "binance-account";
  observedAtMs: number;
};

export type ServerDerivedLiveOrderIntent = {
  executionMode: "live";
  venue: "binance";
  platformKeyId: string;
  keyVersion: number;
  mandateId: string;
  mandateVersion: number;
  authorityState: AuthorityState;
  authorityVersion: number;
  approvalExpiresAtMs: number;
  order: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT";
    quantity: number | null;
    quoteOrderQty: number | null;
    price: number | null;
    timeInForce: "GTC" | "IOC" | "FOK";
  };
  verifiedBalance: VerifiedBalanceSnapshot;
  idempotencyKey: string;
};

export type CreateLiveOrderIntentInput = Omit<ServerDerivedLiveOrderIntent, "executionMode" | "idempotencyKey"> & {
  nowMs?: number;
};

/**
 * Validate and mint a server-owned live order intent. No browser-supplied
 * mandate, key version, balance snapshot, or idempotency key can be accepted
 * by this function.
 */
export function createServerDerivedLiveOrderIntent(input: CreateLiveOrderIntentInput): ServerDerivedLiveOrderIntent {
  const nowMs = input.nowMs ?? Date.now();
  const symbol = input.order.symbol.trim().toUpperCase();
  if (!CANONICAL_BINANCE_SYMBOL.test(symbol) || RESERVED_SYMBOLS.has(symbol)) {
    throw new Error("Live order intent requires a canonical Binance symbol.");
  }
  if (!input.platformKeyId.trim() || !input.mandateId.trim()) throw new Error("Live order intent requires server-resolved key and mandate identifiers.");
  if (!BINANCE_SIDES.has(input.order.side) || !BINANCE_ORDER_TYPES.has(input.order.type) || !BINANCE_TIME_IN_FORCE.has(input.order.timeInForce)) {
    throw new Error("Live order intent contains an unsupported Binance order field.");
  }
  if (!Number.isSafeInteger(input.keyVersion) || input.keyVersion < 1) throw new Error("Live order intent requires a verified key version.");
  if (!Number.isSafeInteger(input.mandateVersion) || input.mandateVersion < 1) throw new Error("Live order intent requires a mandate version.");
  if (!Number.isSafeInteger(input.authorityVersion) || input.authorityVersion < 1) throw new Error("Live order intent requires an authority version.");
  if (!Number.isSafeInteger(input.approvalExpiresAtMs) || input.approvalExpiresAtMs <= nowMs || input.approvalExpiresAtMs - nowMs > 10 * 60_000) {
    throw new Error("Live order intent requires an approval expiry within ten minutes.");
  }
  if (input.verifiedBalance.source !== "binance-account" || !Number.isFinite(input.verifiedBalance.availableUsd) || input.verifiedBalance.availableUsd <= 0) {
    throw new Error("Live order intent requires a verified positive Binance balance snapshot.");
  }
  if (!Number.isSafeInteger(input.verifiedBalance.observedAtMs) || input.verifiedBalance.observedAtMs > nowMs || nowMs - input.verifiedBalance.observedAtMs > MAX_BALANCE_SNAPSHOT_AGE_MS) {
    throw new Error("Live order intent requires a fresh verified balance snapshot.");
  }
  const { quantity, quoteOrderQty, price } = input.order;
  const hasQuantity = Number.isFinite(quantity) && quantity! > 0;
  const hasQuoteOrderQty = Number.isFinite(quoteOrderQty) && quoteOrderQty! > 0;
  const hasPrice = Number.isFinite(price) && price! > 0;
  if (input.order.type === "MARKET" && (hasQuantity === hasQuoteOrderQty || hasPrice)) {
    throw new Error("Market live intent requires exactly one positive quantity or quote amount, without a supplied price.");
  }
  if (input.order.type === "LIMIT" && (!hasQuantity || !hasPrice || hasQuoteOrderQty)) {
    throw new Error("Limit live intent requires a positive quantity and limit price only.");
  }

  return {
    ...input,
    executionMode: "live",
    order: { ...input.order, symbol, quantity: quantity ?? null, quoteOrderQty: quoteOrderQty ?? null, price: price ?? null },
    idempotencyKey: `live_${nanoid(28)}`,
  };
}
