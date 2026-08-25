import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  AUTHORITY_STATE_MACHINE_VERSION,
  AuthorityBlockedError,
  AuthorityState,
  assertAuthorityAllows,
  canPlaceOrders,
  canReadLive,
  evaluateAuthorityTransition,
  isBlockedByDominantState,
} from "./authorityState";

const ALL_STATES: AuthorityState[] = [
  "disabled",
  "sandbox-only",
  "read-only-live",
  "approval-required-live",
  "limited-live",
  "paused",
  "revoked",
];

describe("authority state machine", () => {
  it("is versioned and covers every state in the transition table", () => {
    expect(AUTHORITY_STATE_MACHINE_VERSION).toBe(1);
    for (const state of ALL_STATES) {
      expect(ALLOWED_TRANSITIONS[state]).toBeDefined();
    }
  });

  it("allows the canonical forward path", () => {
    const path = ["disabled", "sandbox-only", "read-only-live", "approval-required-live", "limited-live"] as const;
    for (let i = 0; i < path.length - 1; i++) {
      const result = evaluateAuthorityTransition({ from: path[i], to: path[i + 1], initiatedBy: "owner-1", reason: "owner approved next stage" });
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects skipping stages (no sudden removal of protections)", () => {
    for (const [from, to] of [
      ["disabled", "limited-live"],
      ["disabled", "read-only-live"],
      ["sandbox-only", "limited-live"],
      ["sandbox-only", "approval-required-live"],
      ["read-only-live", "limited-live"],
    ] as const) {
      const result = evaluateAuthorityTransition({ from, to, initiatedBy: "owner-1", reason: "attempted skip" });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.reason).toMatch(/not an allowed edge/);
    }
  });

  it("treats revoked as terminal with no outgoing transitions", () => {
    for (const to of ALL_STATES) {
      expect(evaluateAuthorityTransition({ from: "revoked", to, initiatedBy: "owner-1", reason: "try to revive" }).allowed).toBe(false);
    }
  });

  it("never resumes from paused directly into a live state", () => {
    for (const to of ALL_STATES) {
      const result = evaluateAuthorityTransition({ from: "paused", to, initiatedBy: "owner-1", reason: "resume attempt" });
      if (result.allowed) {
        expect(["sandbox-only", "revoked"]).toContain(to);
      } else {
        expect(["disabled", "read-only-live", "approval-required-live", "limited-live", "paused"]).toContain(to);
      }
    }
  });

  it("requires initiator and reason on every transition", () => {
    expect(() => evaluateAuthorityTransition({ from: "disabled", to: "sandbox-only", initiatedBy: "", reason: "valid reason here" })).toThrow();
    expect(() => evaluateAuthorityTransition({ from: "disabled", to: "sandbox-only", initiatedBy: "owner-1", reason: "" })).toThrow();
    expect(() =>
      evaluateAuthorityTransition({ from: "disabled", to: "sandbox-only", initiatedBy: "owner-1", reason: "no" }),
    ).toThrow();
  });

  it("rejects unknown states at the type boundary", () => {
    expect(() => evaluateAuthorityTransition({ from: "total-control" as never, to: "paused", initiatedBy: "x", reason: "bad state" })).toThrow();
  });
});

describe("dominance & runtime assertions (fail closed)", () => {
  it("marks disabled, paused, revoked as dominant blocking states", () => {
    for (const s of ["disabled", "paused", "revoked"] as AuthorityState[]) {
      expect(isBlockedByDominantState(s)).toBe(true);
    }
    for (const s of ["sandbox-only", "read-only-live", "approval-required-live", "limited-live"] as AuthorityState[]) {
      expect(isBlockedByDominantState(s)).toBe(false);
    }
  });

  it("permits order placement only in approval-required-live and limited-live", () => {
    for (const s of ALL_STATES) {
      expect(canPlaceOrders(s)).toBe(["approval-required-live", "limited-live"].includes(s));
    }
  });

  it("assertAuthorityAllows throws for order placement outside live states", () => {
    for (const s of ["disabled", "sandbox-only", "read-only-live", "paused", "revoked"] as AuthorityState[]) {
      expect(() => assertAuthorityAllows(s, "place-order")).toThrow(AuthorityBlockedError);
    }
    expect(() => assertAuthorityAllows("approval-required-live", "place-order")).not.toThrow();
    expect(() => assertAuthorityAllows("limited-live", "place-order")).not.toThrow();
  });

  it("assertAuthorityAllows blocks live reads below read-only-live", () => {
    expect(() => assertAuthorityAllows("sandbox-only", "read-live")).toThrow(AuthorityBlockedError);
    expect(() => assertAuthorityAllows("disabled", "read-live")).toThrow(AuthorityBlockedError);
    expect(() => assertAuthorityAllows("read-only-live", "read-live")).not.toThrow();
  });

  it("blocked errors carry truthful state and action context", () => {
    try {
      assertAuthorityAllows("paused", "place-order");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthorityBlockedError);
      const err = e as AuthorityBlockedError;
      expect(err.state).toBe("paused");
      expect(err.action).toBe("place-order");
      expect(err.message).toContain("paused");
    }
  });
});
