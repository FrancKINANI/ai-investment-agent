/**
 * Mandate ↔ authority reconciliation (Stage 5).
 *
 * The authority state machine (shared/authorityState.ts) is the single source
 * of truth for live execution. Legacy wallet mandate modes are advisory labels:
 * a mandate claiming "real" means nothing unless the global authority state is
 * a live-execution state. BOTH must agree before any order is submitted.
 *
 * Reconciliation table (authorityState × legacy mandate mode):
 *   any blocking state (disabled/paused/revoked)  → never execute
 *   read-only-live                                → never execute (reads only)
 *   approval-required-live                        → execute only if mandate real/armed AND per-order approval
 *   limited-live                                  → execute only if mandate real/armed (mandate caps still apply)
 *   sandbox-only / disabled mandate modes         → never execute live
 */

import type { AuthorityState } from "./authorityState";

export type LegacyMandateMode = "simulation" | "armed" | "real" | "paused";

export type LiveExecutionVerdict =
  | { allowed: true; requiresPerOrderApproval: boolean }
  | { allowed: false; reason: string };

/** Legacy mandate modes that represent genuine live intent. */
const LIVE_INTENT_MODES: ReadonlySet<LegacyMandateMode> = new Set<LegacyMandateMode>(["real", "armed"]);

const BLOCKING_STATES: ReadonlySet<AuthorityState> = new Set<AuthorityState>(["disabled", "paused", "revoked"]);

/**
 * Decide whether a live order may proceed, given the global authority state and
 * the legacy mandate mode. Deterministic, pure, no I/O.
 */
export function reconcileLiveExecution(args: {
  authorityState: AuthorityState;
  mandateMode: LegacyMandateMode;
  mandateStatus: string;
}): LiveExecutionVerdict {
  const { authorityState, mandateMode } = args;

  if (BLOCKING_STATES.has(authorityState)) {
    return { allowed: false, reason: `Authority state "${authorityState}" blocks live execution (dominant state).` };
  }
  if (args.mandateStatus !== "active") {
    return { allowed: false, reason: `Mandate status is "${args.mandateStatus}", not active.` };
  }

  switch (authorityState) {
    case "sandbox-only":
      return { allowed: false, reason: `Authority state "sandbox-only" permits paper/sandbox only; live execution is not enabled. Raise authority to approval-required-live first.` };
    case "read-only-live":
      return { allowed: false, reason: `Authority state "read-only-live" permits market data reads only; order placement is not enabled.` };
    case "approval-required-live":
      if (!LIVE_INTENT_MODES.has(mandateMode)) {
        return { allowed: false, reason: `Mandate mode "${mandateMode}" does not express live intent; set the mandate to real/armed to agree with authority state "${authorityState}".` };
      }
      return { allowed: true, requiresPerOrderApproval: true };
    case "limited-live":
      if (!LIVE_INTENT_MODES.has(mandateMode)) {
        return { allowed: false, reason: `Mandate mode "${mandateMode}" does not express live intent; set the mandate to real/armed to agree with authority state "${authorityState}".` };
      }
      return { allowed: true, requiresPerOrderApproval: false };
    default:
      return { allowed: false, reason: `Unknown authority state "${authorityState}"; refusing to execute (fail closed).` };
  }
}

/** Canonical hash input for per-order owner approval (exact-order identity). */
export function liveOrderApprovalHash(parts: {
  symbol: string;
  side: string;
  quantity?: number | null;
  quoteOrderQty?: number | null;
  price?: number | null;
  idempotencyKey: string;
}): string {
  // Stable field ordering; quantities normalized via String() to avoid float drift.
  const canonical = JSON.stringify([
    parts.symbol.toUpperCase(),
    parts.side.toUpperCase(),
    parts.quantity != null ? String(parts.quantity) : null,
    parts.quoteOrderQty != null ? String(parts.quoteOrderQty) : null,
    parts.price != null ? String(parts.price) : null,
    parts.idempotencyKey,
  ]);
  // FNV-1a 32-bit, hex-padded — deterministic across processes for this small keyspace.
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
