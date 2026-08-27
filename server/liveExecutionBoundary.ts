import { TRPCError } from "@trpc/server";

/**
 * The audited production boundary: venue mutations remain physically sealed
 * until a separately approved real-execution programme completes. This is a
 * compile-time safety control, deliberately not an environment toggle that a
 * deployment configuration can enable by accident.
 */
export const LIVE_VENUE_MUTATIONS_SEALED = true;

export class LiveVenueMutationSealedError extends Error {
  constructor() {
    super("Live venue mutations are sealed. Ledgerline is restricted to research, read-only verification, and paper simulation.");
    this.name = "LiveVenueMutationSealedError";
  }
}

export function assertLiveVenueMutationAllowed() {
  if (LIVE_VENUE_MUTATIONS_SEALED) throw new LiveVenueMutationSealedError();
}

export function assertLiveVenueMutationsSealed() {
  try {
    assertLiveVenueMutationAllowed();
  } catch (error) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: error instanceof Error ? error.message : "Live venue mutations are sealed.",
    });
  }
}
