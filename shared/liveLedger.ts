/**
 * Live venue ledger lifecycle.
 *
 * This contract is intentionally separate from the deterministic paper model:
 * a venue acknowledgement is not a fill, and unknown outcomes must remain
 * explicitly unknown until a later reconciliation proves otherwise.
 */
export const LIVE_LEDGER_EVENT_TYPES = [
  "submitted",
  "acknowledged",
  "partially_filled",
  "filled",
  "cancelled",
  "rejected",
  "unknown",
  "reconciled",
] as const;

export type LiveLedgerEventType = (typeof LIVE_LEDGER_EVENT_TYPES)[number];

export type BinanceOrderLifecycle = {
  eventType: LiveLedgerEventType;
  intentStatus: "submitted" | "acknowledged" | "partially_filled" | "filled" | "cancelled" | "rejected" | "unknown";
  terminal: boolean;
};

/** Map Binance status without ever inferring a fill from an acknowledgement. */
export function mapBinanceOrderStatus(status: string): BinanceOrderLifecycle {
  switch (status.trim().toUpperCase()) {
    case "NEW":
    case "PENDING_NEW":
      return { eventType: "acknowledged", intentStatus: "acknowledged", terminal: false };
    case "PARTIALLY_FILLED":
      return { eventType: "partially_filled", intentStatus: "partially_filled", terminal: false };
    case "FILLED":
      return { eventType: "filled", intentStatus: "filled", terminal: true };
    case "CANCELED":
    case "EXPIRED":
    case "EXPIRED_IN_MATCH":
      return { eventType: "cancelled", intentStatus: "cancelled", terminal: true };
    case "REJECTED":
      return { eventType: "rejected", intentStatus: "rejected", terminal: true };
    default:
      return { eventType: "unknown", intentStatus: "unknown", terminal: false };
  }
}

/** Fixed initial sequence for the one submission and its first venue response. */
export function initialLiveLedgerSeq(eventType: LiveLedgerEventType): number {
  const order: Record<LiveLedgerEventType, number> = {
    submitted: 2,
    acknowledged: 3,
    partially_filled: 4,
    filled: 5,
    cancelled: 5,
    rejected: 5,
    unknown: 3,
    reconciled: 6,
  };
  return order[eventType];
}
