/**
 * Read-only live data adapters (Stage 2).
 *
 * Disciplined market/account READS only. Never places orders, never signs,
 * never sends credentials for anything beyond read scopes.
 *
 * Guarantees:
 * - Strict response schemas: upstream shapes are validated before use; drift fails closed.
 * - Hard timeouts on every outbound call.
 * - Per-venue rate limiting (token bucket) — 429s are avoided, not survived.
 * - Freshness metadata on every success: source, fetchedAt, latency.
 * - Truthful failure envelopes: callers receive WHY a read failed; nothing is invented.
 * - Authority-gated: reads only fire when the owner's authority state permits
 *   live reads ("read-only-live" and above). Blocked states never touch the network.
 */

import { z } from "zod";
import { canReadLive, type AuthorityState } from "@shared/authorityState";

// ─── Envelope ─────────────────────────────────────────────────────────────

export type LiveDataSuccess<T> = {
  ok: true;
  data: T;
  source: string;
  fetchedAtMs: number;
  latencyMs: number;
};

export type LiveDataFailure = {
  ok: false;
  source: string;
  errorKind: "authority-blocked" | "rate-limited" | "timeout" | "schema" | "network";
  message: string;
};

export type LiveReadResult<T> = LiveDataSuccess<T> | LiveDataFailure;

export function isFresh<T>(result: LiveReadResult<T>, maxAgeMs: number, nowMs: number): boolean {
  return result.ok && nowMs - result.fetchedAtMs <= maxAgeMs;
}

// ─── Rate limiting (token bucket, per venue, process-local) ────────────────

type Bucket = { tokens: number; lastRefillMs: number };
const buckets = new Map<string, Bucket>();

export function configureRateLimit(venueKey: string, opts: { capacity: number; refillPerSecond: number }) {
  buckets.set(venueKey, { tokens: opts.capacity, lastRefillMs: Date.now() });
  rateLimitConfig.set(venueKey, opts);
}

const rateLimitConfig = new Map<string, { capacity: number; refillPerSecond: number }>();

/** Default: conservative public-API pacing. */
export const DEFAULT_RATE_LIMIT = { capacity: 5, refillPerSecond: 2 };

export function tryTakeToken(venueKey: string, nowMs = Date.now()): boolean {
  const cfg = rateLimitConfig.get(venueKey) ?? DEFAULT_RATE_LIMIT;
  let bucket = buckets.get(venueKey);
  if (!bucket) {
    bucket = { tokens: cfg.capacity, lastRefillMs: nowMs };
    buckets.set(venueKey, bucket);
  }
  const elapsedS = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
  bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsedS * cfg.refillPerSecond);
  bucket.lastRefillMs = nowMs;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

export function resetRateLimits() {
  buckets.clear();
  rateLimitConfig.clear();
}

// ─── Core reader ──────────────────────────────────────────────────────────

export async function readLiveData<T>(args: {
  source: string;
  venueKey: string;
  authorityState: AuthorityState;
  url: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  nowMs?: number;
}): Promise<LiveReadResult<T>> {
  const source = args.source;
  const nowMs = args.nowMs ?? Date.now();

  // 1. Authority dominates: blocked states never generate outbound traffic.
  if (!canReadLive(args.authorityState)) {
    return {
      ok: false,
      source,
      errorKind: "authority-blocked",
      message: `Authority state "${args.authorityState}" does not permit live data reads.`,
    };
  }

  // 2. Rate limit before any network I/O.
  if (!tryTakeToken(args.venueKey, nowMs)) {
    return { ok: false, source, errorKind: "rate-limited", message: `Rate limit exhausted for ${args.venueKey}; retry shortly.` };
  }

  // 3. Fetch with hard timeout.
  const timeoutMs = args.timeoutMs ?? 5_000;
  const fetchImpl = args.fetchImpl ?? fetch;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let body: unknown;
  try {
    const response = await fetchImpl(args.url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) {
      return { ok: false, source, errorKind: "network", message: `Upstream ${args.venueKey} returned HTTP ${response.status}.` };
    }
    body = await response.json();
  } catch (e) {
    const aborted = controller.signal.aborted || (e instanceof Error && e.name === "AbortError");
    return aborted
      ? { ok: false, source, errorKind: "timeout", message: `Upstream read timed out after ${timeoutMs}ms.` }
      : { ok: false, source, errorKind: "network", message: `Network failure reading ${source}: ${e instanceof Error ? e.message : "unknown"}.` };
  } finally {
    clearTimeout(timer);
  }

  // 4. Strict schema validation; drift is a failure, never coerced silently.
  const parsed = args.schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, source, errorKind: "schema", message: `Upstream response failed schema validation: ${parsed.error.issues[0]?.message ?? "invalid shape"}.` };
  }

  return { ok: true, data: parsed.data, source, fetchedAtMs: nowMs, latencyMs: Date.now() - startedAt };
}

// ─── Binance public market data (no credentials) ───────────────────────────

export const BinanceTickerSchema = z.object({
  symbol: z.string().min(3).max(20),
  price: z.string().regex(/^\d+(\.\d+)?$/).transform(Number),
}).passthrough();
export type BinanceTicker = z.infer<typeof BinanceTickerSchema>;

export function binanceTickerUrl(symbol: string): string {
  return `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol.toUpperCase())}`;
}

export function readBinanceTicker(args: {
  symbol: string;
  authorityState: AuthorityState;
  fetchImpl?: typeof fetch;
}): Promise<LiveReadResult<BinanceTicker>> {
  return readLiveData({
    source: "binance:api/v3/ticker/price",
    venueKey: "binance-public",
    authorityState: args.authorityState,
    url: binanceTickerUrl(args.symbol),
    schema: BinanceTickerSchema,
    fetchImpl: args.fetchImpl,
  });
}
