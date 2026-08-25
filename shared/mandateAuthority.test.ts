import { describe, expect, it } from "vitest";
import { liveOrderApprovalHash, reconcileLiveExecution } from "./mandateAuthority";
import type { AuthorityState } from "./authorityState";

const base = { mandateStatus: "active" };

describe("reconcileLiveExecution (authority machine is the source of truth)", () => {
  it.each(["disabled", "paused", "revoked"] as AuthorityState[])(
    "blocks live execution in dominant state %s even when mandate claims 'real'",
    (state) => {
      const v = reconcileLiveExecution({ authorityState: state, mandateMode: "real", ...base });
      expect(v.allowed).toBe(false);
    },
  );

  it("blocks in sandbox-only and read-only-live regardless of mandate mode", () => {
    for (const state of ["sandbox-only", "read-only-live"] as AuthorityState[]) {
      for (const mode of ["real", "armed"] as const) {
        expect(reconcileLiveExecution({ authorityState: state, mandateMode: mode, ...base }).allowed).toBe(false);
      }
    }
  });

  it("approval-required-live executes only with real/armed mandate and requires per-order approval", () => {
    const ok = reconcileLiveExecution({ authorityState: "approval-required-live", mandateMode: "real", ...base });
    expect(ok).toEqual({ allowed: true, requiresPerOrderApproval: true });

    const armed = reconcileLiveExecution({ authorityState: "approval-required-live", mandateMode: "armed", ...base });
    expect(armed).toEqual({ allowed: true, requiresPerOrderApproval: true });
  });

  it("limited-live executes without per-order approval but still needs mandate agreement", () => {
    expect(reconcileLiveExecution({ authorityState: "limited-live", mandateMode: "real", ...base }))
      .toEqual({ allowed: true, requiresPerOrderApproval: false });
  });

  it("blocks when legacy mandate disagrees with a live authority state (simulation/paused)", () => {
    for (const state of ["approval-required-live", "limited-live"] as AuthorityState[]) {
      for (const mode of ["simulation", "paused"] as const) {
        const v = reconcileLiveExecution({ authorityState: state, mandateMode: mode, ...base });
        expect(v.allowed).toBe(false);
        if (!v.allowed) expect(v.reason).toContain("does not express live intent");
      }
    }
  });

  it("blocks inactive mandates", () => {
    const v = reconcileLiveExecution({ authorityState: "limited-live", mandateMode: "real", mandateStatus: "paused" });
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.reason).toContain("not active");
  });
});

describe("liveOrderApprovalHash", () => {
  it("is deterministic for identical orders", () => {
    const args = { symbol: "BTCUSDT", side: "BUY", quoteOrderQty: 100, idempotencyKey: "key-1" };
    expect(liveOrderApprovalHash(args)).toBe(liveOrderApprovalHash({ ...args }));
  });

  it("changes when any order component changes", () => {
    const a = liveOrderApprovalHash({ symbol: "BTCUSDT", side: "BUY", quoteOrderQty: 100, idempotencyKey: "k1" });
    expect(liveOrderApprovalHash({ symbol: "ETHUSDT", side: "BUY", quoteOrderQty: 100, idempotencyKey: "k1" })).not.toBe(a);
    expect(liveOrderApprovalHash({ symbol: "BTCUSDT", side: "SELL", quoteOrderQty: 100, idempotencyKey: "k1" })).not.toBe(a);
    expect(liveOrderApprovalHash({ symbol: "BTCUSDT", side: "BUY", quoteOrderQty: 101, idempotencyKey: "k1" })).not.toBe(a);
    expect(liveOrderApprovalHash({ symbol: "BTCUSDT", side: "BUY", quoteOrderQty: 100, idempotencyKey: "k2" })).not.toBe(a);
  });
});
