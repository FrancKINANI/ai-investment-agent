/**
 * Ledgerline authority state machine (versioned).
 *
 * Single source of truth for real-mode execution authority:
 *   disabled → sandbox-only → read-only-live → approval-required-live → limited-live → paused → revoked
 *
 * Rules enforced here:
 * - `paused` and `revoked` dominate every other state (fail closed).
 * - Every transition must be one of the explicitly allowed edges below.
 * - Transitions are recorded by the caller into the operator audit log;
 *   this module is pure and deterministic so negative tests are cheap.
 *
 * This module introduces NO live authority by itself. The system default is `disabled`.
 */

import { z } from "zod";

export const AUTHORITY_STATE_MACHINE_VERSION = 1;

export const AuthorityState = z.enum([
  "disabled",
  "sandbox-only",
  "read-only-live",
  "approval-required-live",
  "limited-live",
  "paused",
  "revoked",
]);
export type AuthorityState = z.infer<typeof AuthorityState>;

/** States in which order placement (any mutation against a venue) is permitted at all. */
const ORDER_PLACING_STATES: ReadonlySet<AuthorityState> = new Set<AuthorityState>([
  "approval-required-live",
  "limited-live",
]);

/** States in which read-only live market/account data may be fetched. */
const READ_ONLY_LIVE_STATES: ReadonlySet<AuthorityState> = new Set<AuthorityState>([
  "read-only-live",
  "approval-required-live",
  "limited-live",
]);

/** Explicitly allowed forward/backward transitions. Anything else is rejected. */
export const ALLOWED_TRANSITIONS: Readonly<Record<AuthorityState, readonly AuthorityState[]>> = {
  "disabled": ["sandbox-only"],
  "sandbox-only": ["disabled", "read-only-live"],
  "read-only-live": ["sandbox-only", "approval-required-live", "paused", "revoked"],
  "approval-required-live": ["read-only-live", "limited-live", "paused", "revoked"],
  "limited-live": ["approval-required-live", "paused", "revoked"],
  "paused": ["sandbox-only", "revoked"], // resume only to a safe state; never straight back to live
  "revoked": [], // terminal; requires a fresh owner-approved provisioning flow (new record)
};

export const AuthorityTransitionInput = z.object({
  from: AuthorityState,
  to: AuthorityState,
  /** Owner identity initiating or approving this transition. Required for every transition. */
  initiatedBy: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(4).max(800),
});
export type AuthorityTransitionInput = z.infer<typeof AuthorityTransitionInput>;

export type AuthorityTransitionResult =
  | { allowed: true; from: AuthorityState; to: AuthorityState }
  | { allowed: false; from: AuthorityState; to: AuthorityState; reason: string };

export function evaluateAuthorityTransition(input: AuthorityTransitionInput): AuthorityTransitionResult {
  const parsed = AuthorityTransitionInput.parse(input);
  const targets = ALLOWED_TRANSITIONS[parsed.from];
  if (!targets.includes(parsed.to)) {
    return {
      allowed: false,
      from: parsed.from,
      to: parsed.to,
      reason: `Transition ${parsed.from} → ${parsed.to} is not an allowed edge of authority state machine v${AUTHORITY_STATE_MACHINE_VERSION}. Allowed: ${targets.join(", ") || "(none)"}.`,
    };
  }
  return { allowed: true, from: parsed.from, to: parsed.to };
}

/** Does the current state permit placing orders (subject to further mandate checks)? */
export function canPlaceOrders(state: AuthorityState): boolean {
  return ORDER_PLACING_STATES.has(state);
}

/** Does the current state permit read-only live data access? */
export function canReadLive(state: AuthorityState): boolean {
  return READ_ONLY_LIVE_STATES.has(state);
}

/** True when paused/revoked dominates regardless of any other stored state. */
export function isBlockedByDominantState(state: AuthorityState): boolean {
  return state === "paused" || state === "revoked" || state === "disabled";
}

/**
 * Runtime assertion used on every sensitive path. Fail closed:
 * throws unless the state explicitly grants the requested capability.
 */
export class AuthorityBlockedError extends Error {
  constructor(
    public readonly state: AuthorityState,
    public readonly action: "place-order" | "cancel-order" | "read-live",
    message?: string,
  ) {
    super(message ?? `Authority blocked: state "${state}" does not permit ${action}.`);
    this.name = "AuthorityBlockedError";
  }
}

export function assertAuthorityAllows(
  state: AuthorityState,
  action: "place-order" | "cancel-order" | "read-live",
): void {
  if (isBlockedByDominantState(state)) {
    throw new AuthorityBlockedError(state, action, `Authority state "${state}" blocks all ${action} activity (dominant state).`);
  }
  if ((action === "place-order" || action === "cancel-order") && !canPlaceOrders(state)) {
    throw new AuthorityBlockedError(state, action, `Authority state "${state}" does not permit ${action}.`);
  }
  if (action === "read-live" && !canReadLive(state)) {
    throw new AuthorityBlockedError(state, action, `Authority state "${state}" does not permit live reads.`);
  }
}

/** Truthful UI label mapping. Never present simulation as live or vice versa. */
export const AUTHORITY_STATE_LABELS: Record<AuthorityState, string> = {
  "disabled": "Disabled · no live activity",
  "sandbox-only": "Sandbox / Paper only",
  "read-only-live": "Live data (read-only)",
  "approval-required-live": "Live · owner approval per order",
  "limited-live": "Live · limited autonomy",
  "paused": "Paused · kill switch active",
  "revoked": "Revoked · re-provisioning required",
};
