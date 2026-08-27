import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, sensitiveProcedure } from "./_core/trpc";
import { getAuthorityState } from "./db";
import { readBinanceTicker } from "./liveData";
import {
  getLiveBalances,
  getLiveTicker,
  getLiveOpenOrders,
} from "./liveAdapter";
import { BinanceApiError, getPrice, getExchangeInfo } from "./binance";
import { assertLiveVenueMutationsSealed } from "./liveExecutionBoundary";

function liveReadError(error: unknown, fallbackCode: "BINANCE_READ_UNAVAILABLE" | "LIVE_ACCOUNT_READ_UNAVAILABLE") {
  return new TRPCError({
    code: "BAD_GATEWAY",
    message: error instanceof BinanceApiError ? error.code : fallbackCode,
  });
}

// ─── Router ───────────────────────────────────────────────────────────────

export const liveRouter = router({
  /** Get real-time price for a symbol. */
  price: protectedProcedure.input(z.object({ symbol: z.string().trim().min(3).max(20) })).query(async ({ input }) => {
    try {
      return await getPrice(input.symbol);
    } catch (error) {
      throw liveReadError(error, "BINANCE_READ_UNAVAILABLE");
    }
  }),

  /** Get real balances from Binance. */
  balances: protectedProcedure.input(z.object({ platformKeyId: z.string().trim().min(1).max(64) })).query(async ({ ctx, input }) => {
    try {
      return await getLiveBalances(ctx.user.id, input.platformKeyId);
    } catch (error) {
      throw liveReadError(error, "LIVE_ACCOUNT_READ_UNAVAILABLE");
    }
  }),

  /** Get 24h ticker data. */
  ticker: protectedProcedure.input(z.object({ symbol: z.string().trim().min(3).max(20) })).query(async ({ input }) => {
    try {
      return await getLiveTicker(input.symbol);
    } catch (error) {
      throw liveReadError(error, "BINANCE_READ_UNAVAILABLE");
    }
  }),

  /** Truthful live price: strict schema, freshness metadata, honest failure envelope. */
  truthfulPrice: protectedProcedure.input(z.object({ symbol: z.string().trim().min(3).max(20) })).query(async ({ ctx, input }) => {
    const authorityState = await getAuthorityState(ctx.user.id);
    return readBinanceTicker({ symbol: input.symbol, authorityState });
  }),

  /** Get open orders. */
  openOrders: protectedProcedure.input(z.object({
    platformKeyId: z.string().trim().min(1).max(64),
    symbol: z.string().trim().min(3).max(20).optional(),
  })).query(async ({ ctx, input }) => {
    try {
      return await getLiveOpenOrders(ctx.user.id, input.platformKeyId, input.symbol);
    } catch (error) {
      throw liveReadError(error, "LIVE_ACCOUNT_READ_UNAVAILABLE");
    }
  }),

  /** No client-composed order is accepted while the compile-time seal is active. */
  placeOrder: sensitiveProcedure.mutation(async () => {
    assertLiveVenueMutationsSealed();
  }),

  /** No client-composed cancellation is accepted while the compile-time seal is active. */
  cancelOrder: sensitiveProcedure.mutation(async () => {
    assertLiveVenueMutationsSealed();
  }),

  /** Get exchange info (symbol rules, filters). */
  exchangeInfo: protectedProcedure.query(async () => {
    try {
      return await getExchangeInfo();
    } catch (error) {
      throw liveReadError(error, "BINANCE_READ_UNAVAILABLE");
    }
  }),
});
