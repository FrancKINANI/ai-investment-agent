/**
 * Ledgerline Stage 1 — deterministic paper execution core.
 *
 * Pure functions only: no DB, no clock, no network. The caller supplies the
 * authority state, mandate, reference price WITH its timestamp, and "now".
 * This makes every acceptance/rejection decision reproducible and cheap to
 * negative-test. Persistence (append-only execution ledger) lives in server/db.
 *
 * Execution mode here is always "paper" or "sandbox". Live is Stage 5 and
 * separately owner-approved; this module must never be reused silently for live.
 */

import { z } from "zod";
import type { AuthorityState } from "./authorityState";

// ─── Input schemas ────────────────────────────────────────────────────────

export const PaperOrderInput = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  venue: z.enum(["binance", "evm", "polymarket"]),
  symbol: z.string().trim().min(3).max(20).toUpperCase(),
  side: z.enum(["BUY", "SELL"]),
  orderType: z.enum(["MARKET", "LIMIT"]),
  quantity: z.number().positive().optional(),
  price: z.number().positive().optional(),
  quoteOrderQty: z.number().positive().optional(),
}).refine(
  (o) => (o.orderType === "MARKET" ? Boolean(o.quantity || o.quoteOrderQty) : Boolean(o.quantity && o.price)),
  { message: "Market orders need quantity or quoteOrderQty. Limit orders need quantity and price." },
);
export type PaperOrderInput = z.infer<typeof PaperOrderInput>;

export const ReferencePrice = z.object({
  price: z.number().positive(),
  /** Epoch ms when the venue produced this price. Stale prices fail closed. */
  timestampMs: z.number().int().positive(),
});
export type ReferencePrice = z.infer<typeof ReferencePrice>;

export type PaperMandate = {
  mandateId: string;
  status: string;
  venue: string;
  maxOrderBps: number;
  dailyCapBps: number;
  allowedAssets: string[];
};

/** Existing order sharing the caller's idempotency key, if any. */
export type ExistingDuplicate = { orderId: string; status: string } | null;

export const DEFAULT_MAX_PRICE_AGE_MS = 60_000;

export type Decision =
  | {
      action: "execute";
      orderId: string;
      fill: {
        fillPrice: number;
        executedQty: number;
        quoteValueUsd: number;
      };
    }
  | { action: "duplicate"; orderId: string; status: string }
  | { action: "reject"; reason: string };

// ─── Deterministic helpers ────────────────────────────────────────────────

/** Stable order id derived from the idempotency key so retries resolve to the same id. */
function deriveOrderId(idempotencyKey: string): string {
  // FNV-1a over the key — deterministic, collision-safe enough for one owner's keyspace.
  let h = 0x811c9dc5;
  for (let i = 0; i < idempotencyKey.length; i++) {
    h ^= idempotencyKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `po-${h.toString(16).padStart(8, "0")}-${idempotencyKey.length}`;
}

function orderValueUsd(order: PaperOrderInput, referencePrice: number): number {
  if (order.quoteOrderQty) return order.quoteOrderQty;
  if (order.quantity) return order.quantity * referencePrice;
  return 0;
}

/**
 * Full pre-trade evaluation. Order of checks is deliberate:
 * duplicate → authority → mandate → data freshness → validation.
 * Every rejection names the failed invariant.
 */
export function decidePaperOrder(args: {
  input: PaperOrderInput;
  authorityState: AuthorityState;
  mandate: PaperMandate | null;
  referencePrice: ReferencePrice | null;
  nowMs: number;
  maxPriceAgeMs?: number;
  duplicate?: ExistingDuplicate;
  mandateBalanceUsd?: number;
}): Decision {
  const { input, authorityState, mandate, referencePrice, nowMs } = args;
  const maxPriceAgeMs = args.maxPriceAgeMs ?? DEFAULT_MAX_PRICE_AGE_MS;

  // 0. Idempotency: same key ⇒ same outcome, never a second fill.
  if (args.duplicate) {
    return { action: "duplicate", orderId: args.duplicate.orderId, status: args.duplicate.status };
  }

  // 1. Authority state machine dominates everything (fail closed).
  // Paper fills are simulated, so any state below paused/revoked/disabled may run them;
  // the dominant blocking states may not.
  if (["disabled", "paused", "revoked"].includes(authorityState)) {
    return { action: "reject", reason: `Authority state "${authorityState}" does not permit paper execution.` };
  }

  // 2. Mandate gates (reuse the same limit semantics as the live adapter).
  if (!mandate) return { action: "reject", reason: "No active mandate found." };
  if (mandate.status !== "active") return { action: "reject", reason: `Mandate is ${mandate.status}, not active.` };
  if (mandate.venue !== input.venue) return { action: "reject", reason: `Mandate venue "${mandate.venue}" does not match order venue "${input.venue}".` };

  const baseAsset = input.symbol.replace(/(USDT|BUSD|USD|BTC|ETH)$/, "");
  if (mandate.allowedAssets.length > 0 && !mandate.allowedAssets.some((a) => a.toUpperCase().includes(baseAsset.toUpperCase()))) {
    return { action: "reject", reason: `Asset "${baseAsset}" is not in the allowed assets list.` };
  }

  // 3. Price freshness (fail closed on missing or stale data).
  if (!referencePrice || !referencePrice.price || referencePrice.timestampMs <= 0) {
    return { action: "reject", reason: "No valid reference price available; refusing to simulate a fill without market truth." };
  }
  const ageMs = nowMs - referencePrice.timestampMs;
  if (ageMs > maxPriceAgeMs) {
    return { action: "reject", reason: `Reference price is stale (${Math.round(ageMs / 1000)}s old, max ${Math.round(maxPriceAgeMs / 1000)}s).` };
  }
  if (ageMs < 0) {
    return { action: "reject", reason: "Reference price timestamp is in the future; inconsistent data rejected." };
  }

  // 4. Limit orders never cross deterministically below their price.
  if (input.orderType === "LIMIT" && input.side === "BUY" && input.price! < referencePrice.price) {
    // Deterministic paper model: resting limit buys do not fill immediately.
    return { action: "reject", reason: "LIMIT BUY below reference price rests unfilled in the deterministic paper model." };
  }
  if (input.orderType === "LIMIT" && input.side === "SELL" && input.price! > referencePrice.price) {
    return { action: "reject", reason: "LIMIT SELL above reference price rests unfilled in the deterministic paper model." };
  }

  // 5. Mandate size limits against true reference value.
  const valueUsd = orderValueUsd(input, referencePrice.price);
  if (args.mandateBalanceUsd !== undefined) {
    const maxOrderUsd = (args.mandateBalanceUsd * mandate.maxOrderBps) / 10_000;
    if (valueUsd > maxOrderUsd) {
      return { action: "reject", reason: `Order value $${valueUsd.toFixed(2)} exceeds per-order cap $${maxOrderUsd.toFixed(2)} (${mandate.maxOrderBps}bps of balance).` };
    }
  }

  // 6. Execute deterministically at the reference price, zero slippage.
  const executedQty = input.quantity ?? (input.quoteOrderQty ? input.quoteOrderQty / referencePrice.price : 0);
  if (!(executedQty > 0)) return { action: "reject", reason: "Computed executed quantity is zero." };

  return {
    action: "execute",
    orderId: deriveOrderId(input.idempotencyKey),
    fill: {
      fillPrice: referencePrice.price,
      executedQty,
      quoteValueUsd: executedQty * referencePrice.price,
    },
  };
}

// ─── Ledger event lifecycle ───────────────────────────────────────────────

export const LEDGER_EVENT_TYPES = [
  "proposed", "validated", "submitted", "filled", "rejected", "cancelled", "reconciled",
] as const;
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

const ORDER: Record<LedgerEventType, number> = {
  proposed: 0, validated: 1, submitted: 2, filled: 3, rejected: 3, cancelled: 4, reconciled: 5,
};

/** Valid lifecycle transitions for ledger events. Append-only: no rewrites, no skips. */
export function isValidLedgerTransition(from: LedgerEventType, to: LedgerEventType): boolean {
  if (from === "rejected" || from === "cancelled") return false; // terminal
  if (from === "reconciled") return false; // terminal
  if (from === "filled") return to === "reconciled";
  if (from === "proposed") return ["validated", "rejected"].includes(to);
  if (from === "validated") return ["submitted", "rejected"].includes(to);
  if (from === "submitted") return ["filled", "rejected"].includes(to);
  return false;
}

export function ledgerSeq(type: LedgerEventType): number {
  return ORDER[type];
}
