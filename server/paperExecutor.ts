/**
 * Paper executor service (Stage 1).
 *
 * Orchestrates the deterministic core (shared/paperExecution) with the
 * append-only execution ledger. Every accepted order walks the full event
 * lifecycle; every rejection is recorded too — the ledger shows what was
 * attempted, not just what succeeded.
 *
 * Execution mode is paper/sandbox only. This service never talks to a venue.
 */
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import {
  getAuthorityState,
  getPaperOrderByIdempotencyKey,
  appendLedgerEvent,
  upsertPaperOrderProjection,
  createOperatorAction,
  getDb,
} from "./db";
import { paperOrders } from "../drizzle/schema";
import {
  PaperOrderInput,
  ReferencePrice,
  decidePaperOrder,
  isValidLedgerTransition,
  ledgerSeq,
  type LedgerEventType,
} from "@shared/paperExecution";
import type { PaperMandate } from "@shared/paperExecution";

export type SubmitPaperOrderArgs = {
  userId: number;
  input: PaperOrderInput;
  mandate: PaperMandate | null;
  mandateBalanceUsd?: number;
  referencePrice: ReferencePrice | null;
};

export type SubmitPaperOrderResult =
  | { status: "filled"; orderId: string; fillPrice: number; executedQty: number }
  | { status: "duplicate"; orderId: string }
  | { status: "rejected"; reason: string };

export async function submitPaperOrder(args: SubmitPaperOrderArgs): Promise<SubmitPaperOrderResult> {
  const { userId, input, mandate, referencePrice } = args;

  const authorityState = await getAuthorityState(userId);
  const existing = await getPaperOrderByIdempotencyKey(userId, input.idempotencyKey);
  const duplicate = existing ? { orderId: existing.orderId, status: existing.status } : null;

  const decision = decidePaperOrder({
    input,
    authorityState,
    mandate,
    referencePrice,
    nowMs: Date.now(),
    duplicate,
    mandateBalanceUsd: args.mandateBalanceUsd,
  });

  if (decision.action === "duplicate") {
    return { status: "duplicate", orderId: decision.orderId };
  }

  // Walk the ledger lifecycle. Rejections still produce proposed → rejected.
  const orderId = decision.action === "execute" ? decision.orderId : `po-rej-${nanoid(10)}`;

  const base = {
    orderId,
    idempotencyKey: input.idempotencyKey,
    venue: input.venue,
    executionMode: "paper" as const,
    symbol: input.symbol,
    side: input.side,
    orderType: input.orderType,
    quantity: input.quantity?.toString() ?? null,
    price: input.price?.toString() ?? null,
    quoteOrderQty: input.quoteOrderQty?.toString() ?? null,
    mandateId: mandate?.mandateId ?? null,
  };

  let lastEvent: LedgerEventType = "proposed";
  await appendLedgerEvent(userId, { ...base, eventType: "proposed", seq: ledgerSeq("proposed"), payload: { by: "owner-or-agent-proposal" } });
  await upsertPaperOrderProjection(userId, { ...base, status: "proposed", reconciliationState: "pending" });

  if (decision.action === "reject") {
    lastEvent = "rejected";
    await appendLedgerEvent(userId, { ...base, eventType: "rejected", seq: ledgerSeq("rejected"), payload: { reason: decision.reason } });
    await upsertPaperOrderProjection(userId, { ...base, status: "rejected", rejectReason: decision.reason });
    await createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "simulation_blocked",
      status: "blocked",
      subject: `Paper order rejected: ${input.symbol} ${input.side}`,
      detail: decision.reason,
      payload: { orderId, input, reason: decision.reason },
    });
    return { status: "rejected", reason: decision.reason };
  }

  for (const next of ["validated", "submitted", "filled"] as LedgerEventType[]) {
    if (!isValidLedgerTransition(lastEvent, next)) throw new Error(`Ledger invariant violated: ${lastEvent} → ${next}`);
    lastEvent = next;
    const payload = next === "filled" ? { ...decision.fill } : { checkedAt: Date.now() };
    await appendLedgerEvent(userId, { ...base, eventType: next, seq: ledgerSeq(next), payload });
  }

  await upsertPaperOrderProjection(userId, {
    ...base,
    status: "filled",
    reconciliationState: "pending",
    fillPrice: decision.fill.fillPrice.toString(),
    executedQty: decision.fill.executedQty.toString(),
  });

  return {
    status: "filled",
    orderId,
    fillPrice: decision.fill.fillPrice,
    executedQty: decision.fill.executedQty,
  };
}

/** Mark an order's reconciliation outcome. Only pending orders can be reconciled. */
export async function reconcilePaperOrder(
  userId: number,
  orderId: string,
  outcome: "matched" | "mismatched",
): Promise<{ ok: boolean; reason?: string }> {
  const existing = await getPaperOrderByOrderId(userId, orderId);
  if (!existing) return { ok: false, reason: "Order not found." };
  if (existing.status !== "filled") return { ok: false, reason: `Only filled orders reconcile; this order is ${existing.status}.` };

  await appendLedgerEvent(userId, {
    orderId,
    idempotencyKey: existing.idempotencyKey,
    venue: existing.venue,
    executionMode: existing.executionMode,
    symbol: existing.symbol,
    side: existing.side,
    orderType: existing.orderType,
    eventType: "reconciled",
    seq: ledgerSeq("reconciled"),
    payload: { outcome },
    mandateId: existing.mandateId,
  });
  await upsertPaperOrderProjection(userId, {
    orderId,
    idempotencyKey: existing.idempotencyKey,
    venue: existing.venue,
    executionMode: existing.executionMode,
    symbol: existing.symbol,
    side: existing.side,
    orderType: existing.orderType,
    status: "reconciled",
    reconciliationState: outcome,
    fillPrice: existing.fillPrice,
    executedQty: existing.executedQty,
    mandateId: existing.mandateId,
  });
  return { ok: true };
}

async function getPaperOrderByOrderId(userId: number, orderId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(paperOrders).where(and(eq(paperOrders.userId, userId), eq(paperOrders.orderId, orderId))).limit(1);
  return rows[0] ?? null;
}
