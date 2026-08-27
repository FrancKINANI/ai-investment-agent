import { createHash } from "node:crypto";
import type { AuthorityState } from "@shared/authorityState";

export const LIVE_APPROVAL_DOMAIN = "ledgerline.live-order-approval.v1";

export type LiveApprovalPayload = {
  venue: "binance";
  platformKeyId: string;
  keyVersion: number;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number | null;
  quoteOrderQty: number | null;
  price: number | null;
  timeInForce: "GTC" | "IOC" | "FOK";
  idempotencyKey: string;
  mandateId: string;
  mandateVersion: number;
  authorityState: AuthorityState;
  authorityVersion: number;
  expiresAtMs: number;
};

function normalizeNumber(value: number | null): string | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) throw new Error("Approval payload contains an invalid positive number.");
  return value.toString();
}

/**
 * Produces one canonical server-side representation. The stored payload lets a
 * reviewer prove exactly what was approved; SHA-256 prevents practical
 * collision substitution of a different order.
 */
export function canonicalizeLiveApprovalPayload(payload: LiveApprovalPayload): string {
  if (!Number.isSafeInteger(payload.keyVersion) || payload.keyVersion < 1) throw new Error("Approval payload has an invalid key version.");
  if (!Number.isSafeInteger(payload.mandateVersion) || payload.mandateVersion < 1) throw new Error("Approval payload has an invalid mandate version.");
  if (!Number.isSafeInteger(payload.authorityVersion) || payload.authorityVersion < 1) throw new Error("Approval payload has an invalid authority version.");
  if (!Number.isSafeInteger(payload.expiresAtMs) || payload.expiresAtMs <= Date.now()) throw new Error("Approval payload has an invalid expiry.");

  return JSON.stringify({
    domain: LIVE_APPROVAL_DOMAIN,
    venue: payload.venue,
    platformKeyId: payload.platformKeyId,
    keyVersion: payload.keyVersion,
    symbol: payload.symbol.trim().toUpperCase(),
    side: payload.side,
    type: payload.type,
    quantity: normalizeNumber(payload.quantity),
    quoteOrderQty: normalizeNumber(payload.quoteOrderQty),
    price: normalizeNumber(payload.price),
    timeInForce: payload.timeInForce,
    idempotencyKey: payload.idempotencyKey,
    mandateId: payload.mandateId,
    mandateVersion: payload.mandateVersion,
    authorityState: payload.authorityState,
    authorityVersion: payload.authorityVersion,
    expiresAtMs: payload.expiresAtMs,
  });
}

export function digestLiveApprovalPayload(canonicalPayload: string): string {
  return createHash("sha256").update(canonicalPayload, "utf8").digest("hex");
}

export function buildLiveApprovalBinding(payload: LiveApprovalPayload) {
  const canonicalPayload = canonicalizeLiveApprovalPayload(payload);
  return { canonicalPayload, approvalDigest: digestLiveApprovalPayload(canonicalPayload) };
}
