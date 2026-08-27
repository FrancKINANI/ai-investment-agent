import type { LiveLedgerEventType } from "@shared/liveLedger";
import { LIVE_VENUE_MUTATIONS_SEALED } from "./liveExecutionBoundary";

export type LiveReconciliationResult = {
  state: "sealed" | "pending";
  nextEventType?: LiveLedgerEventType;
  reason: string;
};

/**
 * Deliberately side-effect-free reconciliation seam. It allows lifecycle tests
 * and a future venue reader to be wired without making the sealed release send
 * orders, cancellations, or credentialed reconciliation calls.
 */
export async function reconcileLiveOrder(): Promise<LiveReconciliationResult> {
  if (LIVE_VENUE_MUTATIONS_SEALED) {
    return { state: "sealed", reason: "Live venue reconciliation is not active while venue mutations are sealed." };
  }
  return { state: "pending", reason: "A separately approved reconciliation worker must query the venue by client order ID." };
}
