import { describe, expect, it } from "vitest";
import { LIVE_VENUE_MUTATIONS_SEALED, assertLiveVenueMutationAllowed, LiveVenueMutationSealedError } from "./liveExecutionBoundary";

describe("Invariant 1: Live Venue Mutations Are Compile-Time Sealed", () => {
  it("LIVE_VENUE_MUTATIONS_SEALED is true", () => {
    expect(LIVE_VENUE_MUTATIONS_SEALED).toBe(true);
  });

  it("assertLiveVenueMutationAllowed throws when sealed", () => {
    let threw = false;
    try {
      assertLiveVenueMutationAllowed();
    } catch (error) {
      threw = true;
      expect(error).toBeInstanceOf(LiveVenueMutationSealedError);
    }
    expect(threw).toBe(true);
  });
});