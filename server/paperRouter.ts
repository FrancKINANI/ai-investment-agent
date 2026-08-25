/**
 * Paper execution router (Stage 1). Owner-scoped. Paper/sandbox only.
 *
 * Residual risk (documented): the reference price is currently supplied by the
 * caller. Paper fills have no financial consequence, but Stage 2 replaces this
 * with a server-side read-only live data adapter so simulated fills always use
 * verified market truth.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { listPaperOrders, getOrderLedger } from "./db";
import { PaperOrderInput, ReferencePrice } from "@shared/paperExecution";
import { reconcilePaperOrder, submitPaperOrder } from "./paperExecutor";

const submitSchema = z.object({
  order: PaperOrderInput,
  mandateId: z.string().trim().min(4).max(64),
  mandateBalanceUsd: z.number().positive().optional(),
  referencePrice: ReferencePrice.nullable(),
});

export const paperRouter = router({
  /** Submit a deterministic paper order; walks the append-only ledger lifecycle. */
  submit: protectedProcedure.input(submitSchema).mutation(async ({ ctx, input }) => {
    // Mandate is loaded server-side; clients cannot self-assert mandate terms.
    const { listWalletMandates } = await import("./db");
    const mandates = await listWalletMandates(ctx.user.id);
    const mandate = mandates.find((m) => m.mandateId === input.mandateId);
    const result = await submitPaperOrder({
      userId: ctx.user.id,
      input: input.order,
      mandate: mandate ?? null,
      mandateBalanceUsd: input.mandateBalanceUsd,
      referencePrice: input.referencePrice,
    });
    if (result.status === "rejected") {
      throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
    }
    return result;
  }),

  orders: protectedProcedure.query(async ({ ctx }) => listPaperOrders(ctx.user.id)),

  ledger: protectedProcedure.input(z.object({ orderId: z.string().trim().min(4).max(64) })).query(async ({ ctx, input }) =>
    getOrderLedger(ctx.user.id, input.orderId),
  ),

  reconcile: protectedProcedure.input(z.object({
    orderId: z.string().trim().min(4).max(64),
    outcome: z.enum(["matched", "mismatched"]),
  })).mutation(async ({ ctx, input }) => {
    const r = await reconcilePaperOrder(ctx.user.id, input.orderId, input.outcome);
    if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.reason });
    return r;
  }),
});
