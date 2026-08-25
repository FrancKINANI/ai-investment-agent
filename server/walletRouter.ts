import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import {
  connectWallet,
  disconnectWallet,
  getActiveSessions,
  requestTransaction,
  getSupportedChains,
  isSupportedChain,
  type WalletProvider,
} from "./walletService";
import {
  createMandate,
  activateMandate,
  revokeMandate,
  listMandates,
  executeMandateTransaction,
  listMandateTransactions,
  getAvailableScopes,
  validateMandateParams,
  type MandateScope,
} from "./sailorService";

// ─── Schemas ──────────────────────────────────────────────────────────────

const connectSchema = z.object({
  provider: z.enum(["walletconnect", "injected", "coinbase"]).default("walletconnect"),
  chainId: z.number().int().positive(),
});

const transactionSchema = z.object({
  sessionId: z.string().trim().min(1).max(64),
  to: z.string().trim().min(1),
  value: z.string().optional(),
  data: z.string().optional(),
  chainId: z.number().int().positive(),
});

const mandateSchema = z.object({
  ownerAddress: z.string().trim().min(1),
  chainId: z.number().int().positive(),
  scopes: z.array(z.enum(["swap", "add_liquidity", "remove_liquidity", "stake", "claim", "transfer"])).min(1).max(6),
  maxTransactionValue: z.string().trim().min(1),
  maxDailyValue: z.string().trim().min(1),
  allowedTokens: z.array(z.string()).optional(),
  allowedProtocols: z.array(z.string()).optional(),
});

const mandateTxSchema = z.object({
  mandateId: z.string().trim().min(1).max(64),
  to: z.string().trim().min(1),
  value: z.string().trim().min(1),
  data: z.string().default("0x"),
  chainId: z.number().int().positive(),
});

// ─── Router ───────────────────────────────────────────────────────────────

export const walletRouter = router({
  // ── Wallet Connection ─────────────────────────────────────────────────
  connect: protectedProcedure.input(connectSchema).mutation(async ({ ctx, input }) => {
    if (!isSupportedChain(input.chainId)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Chain ${input.chainId} is not supported.` });
    }
    try {
      return await connectWallet(ctx.user.id, input.provider as WalletProvider, input.chainId);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Wallet connection failed." });
    }
  }),

  disconnect: protectedProcedure.input(z.object({ sessionId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
    const success = await disconnectWallet(ctx.user.id, input.sessionId);
    if (!success) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
    return { success: true };
  }),

  sessions: protectedProcedure.query(() => getActiveSessions()),

  signTransaction: protectedProcedure.input(transactionSchema).mutation(async ({ ctx, input }) => {
    try {
      return await requestTransaction(ctx.user.id, input.sessionId, {
        to: input.to,
        value: input.value,
        data: input.data,
        chainId: input.chainId,
      });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Transaction signing failed." });
    }
  }),

  supportedChains: protectedProcedure.query(() => getSupportedChains()),

  // ── Sailor Mandates ───────────────────────────────────────────────────
  createMandate: protectedProcedure.input(mandateSchema).mutation(async ({ ctx, input }) => {
    const validation = validateMandateParams({
      scopes: input.scopes as MandateScope[],
      maxTransactionValue: input.maxTransactionValue,
      maxDailyValue: input.maxDailyValue,
    });
    if (!validation.valid) {
      throw new TRPCError({ code: "BAD_REQUEST", message: validation.errors.join(" ") });
    }
    return createMandate(ctx.user.id, {
      ownerAddress: input.ownerAddress,
      chainId: input.chainId,
      scopes: input.scopes as MandateScope[],
      maxTransactionValue: input.maxTransactionValue,
      maxDailyValue: input.maxDailyValue,
      allowedTokens: input.allowedTokens,
      allowedProtocols: input.allowedProtocols,
    });
  }),

  activateMandate: protectedProcedure.input(z.object({
    mandateId: z.string().trim().min(1).max(64),
    contractAddress: z.string().trim().min(1),
  })).mutation(async ({ ctx, input }) => {
    try {
      return await activateMandate(ctx.user.id, input.mandateId, input.contractAddress);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Mandate activation failed." });
    }
  }),

  revokeMandate: protectedProcedure.input(z.object({ mandateId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
    try {
      return await revokeMandate(ctx.user.id, input.mandateId);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Mandate revocation failed." });
    }
  }),

  listMandates: protectedProcedure.query(({ ctx }) => listMandates(ctx.user.id)),

  executeMandateTx: protectedProcedure.input(mandateTxSchema).mutation(async ({ ctx, input }) => {
    try {
      return await executeMandateTransaction(ctx.user.id, input.mandateId, {
        to: input.to,
        value: input.value,
        data: input.data,
        chainId: input.chainId,
      });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Mandate transaction failed." });
    }
  }),

  mandateTransactions: protectedProcedure.input(z.object({ mandateId: z.string().trim().min(1).max(64) })).query(({ input }) => {
    return listMandateTransactions(input.mandateId);
  }),

  availableScopes: protectedProcedure.query(() => getAvailableScopes()),
});
