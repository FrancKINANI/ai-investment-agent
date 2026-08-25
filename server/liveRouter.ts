import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { listWalletMandates, getAuthorityState } from "./db";
import { readBinanceTicker } from "./liveData";
import {
  getLiveBalances,
  getLiveTicker,
  getLiveOpenOrders,
  executeLiveOrder,
  cancelLiveOrder,
} from "./liveAdapter";
import { getPrice, getExchangeInfo } from "./binance";

// ─── Schemas ──────────────────────────────────────────────────────────────

const orderSchema = z.object({
  platformKeyId: z.string().trim().min(1).max(64),
  symbol: z.string().trim().min(3).max(20),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET"]),
  quantity: z.number().positive().optional(),
  quoteOrderQty: z.number().positive().optional(),
  price: z.number().positive().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("GTC"),
}).refine(
  (data) => (data.type === "MARKET" ? data.quantity || data.quoteOrderQty : data.quantity && data.price),
  { message: "Market orders need quantity or quoteOrderQty. Limit orders need quantity and price." },
);

// ─── Router ───────────────────────────────────────────────────────────────

export const liveRouter = router({
  /** Get real-time price for a symbol. */
  price: protectedProcedure.input(z.object({ symbol: z.string().trim().min(3).max(20) })).query(async ({ input }) => {
    try {
      return await getPrice(input.symbol);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Failed to fetch price." });
    }
  }),

  /** Get real balances from Binance. */
  balances: protectedProcedure.input(z.object({ platformKeyId: z.string().trim().min(1).max(64) })).query(async ({ ctx, input }) => {
    try {
      return await getLiveBalances(ctx.user.id, input.platformKeyId);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Failed to fetch balances." });
    }
  }),

  /** Get 24h ticker data. */
  ticker: protectedProcedure.input(z.object({ symbol: z.string().trim().min(3).max(20) })).query(async ({ input }) => {
    try {
      return await getLiveTicker(input.symbol);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Failed to fetch ticker." });
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
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Failed to fetch open orders." });
    }
  }),

  /** Place a live order after mandate checks. */
  placeOrder: protectedProcedure.input(orderSchema).mutation(async ({ ctx, input }) => {
    // Find the active mandate for this venue
    const mandates = await listWalletMandates(ctx.user.id);
    const mandate = mandates.find((m) => m.venue === "binance" && m.status === "active") ?? null;

    // Get account balance for limit checking
    let accountBalanceUsd = 0;
    try {
      const balances = await getLiveBalances(ctx.user.id, input.platformKeyId);
      const usdtBalance = balances.find((b) => b.asset === "USDT" || b.asset === "BUSD" || b.asset === "USD");
      accountBalanceUsd = usdtBalance?.total ?? 0;
    } catch {
      // If we can't get balances, proceed with 0 (mandate check will catch if limits are set)
    }

    try {
      return await executeLiveOrder(ctx.user.id, input.platformKeyId, mandate, {
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        quantity: input.quantity,
        quoteOrderQty: input.quoteOrderQty,
        price: input.price,
        timeInForce: input.timeInForce,
      }, accountBalanceUsd);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Order failed." });
    }
  }),

  /** Cancel a live order. */
  cancelOrder: protectedProcedure.input(z.object({
    platformKeyId: z.string().trim().min(1).max(64),
    symbol: z.string().trim().min(3).max(20),
    orderId: z.number().int().positive(),
  })).mutation(async ({ ctx, input }) => {
    try {
      return await cancelLiveOrder(ctx.user.id, input.platformKeyId, input.symbol, input.orderId);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Cancel failed." });
    }
  }),

  /** Get exchange info (symbol rules, filters). */
  exchangeInfo: protectedProcedure.query(async () => {
    try {
      return await getExchangeInfo();
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Failed to fetch exchange info." });
    }
  }),
});
