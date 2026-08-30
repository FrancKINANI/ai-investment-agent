import { describe, expect, it } from "vitest";
import { LIVE_VENUE_MUTATIONS_SEALED } from "./liveExecutionBoundary";
import { checkRateLimit, resetRateLimit } from "./security";

describe("Invariant 5: Sensitive Procedure Wrapper", () => {
  it("rate limiting works for sensitive procedures", () => {
    resetRateLimit("test-user");
    const result = checkRateLimit("test-user", { maxRequests: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });

  it("live venue mutations are sealed", () => {
    expect(LIVE_VENUE_MUTATIONS_SEALED).toBe(true);
  });
});