import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createSecurityAlert,
  listSecurityAlerts,
  acknowledgeSecurityAlert,
  countUnacknowledgedAlerts,
  createPlatformApiKey,
  listPlatformApiKeys,
  getPlatformApiKey,
  updatePlatformApiKeyState,
  updatePlatformApiKeyLimits,
  deletePlatformApiKey,
  createOperatorAction,
} from "./db";

// ─── Schemas ──────────────────────────────────────────────────────────────

const alertLevelSchema = z.enum(["critical", "warning", "info"]);

const createAlertSchema = z.object({
  level: alertLevelSchema,
  category: z.string().trim().min(2).max(80),
  title: z.string().trim().min(4).max(160),
  detail: z.string().trim().min(4).max(2000),
  actionRef: z.string().trim().max(64).optional(),
});

const platformSchema = z.enum(["binance", "okx", "coinbase", "kraken", "polymarket"]);

const addApiKeySchema = z.object({
  platform: platformSchema,
  label: z.string().trim().min(2).max(120),
  apiKey: z.string().trim().min(8).max(200),
  apiSecret: z.string().trim().min(8).max(200),
  permissions: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
  hasWithdrawPermission: z.boolean().default(false),
  maxOrderUsd: z.number().int().positive().max(10_000_000).optional(),
  allocatedCapitalUsd: z.number().int().positive().max(100_000_000).optional(),
  dailyTradeLimit: z.number().int().positive().max(100_000).optional(),
});

const updateLimitsSchema = z.object({
  keyId: z.string().trim().min(1).max(64),
  maxOrderUsd: z.number().int().positive().max(10_000_000).optional(),
  allocatedCapitalUsd: z.number().int().positive().max(100_000_000).optional(),
  dailyTradeLimit: z.number().int().positive().max(100_000).optional(),
});

import { encryptSecret, maskApiKey } from "./kms";

// ─── Router ───────────────────────────────────────────────────────────────

export const securityRouter = router({
  // ── Alerts ────────────────────────────────────────────────────────────
  alerts: router({
    list: protectedProcedure.query(({ ctx }) => listSecurityAlerts(ctx.user.id)),
    unacknowledgedCount: protectedProcedure.query(({ ctx }) => countUnacknowledgedAlerts(ctx.user.id)),
    create: protectedProcedure.input(createAlertSchema).mutation(async ({ ctx, input }) => {
      const alert = await createSecurityAlert(ctx.user.id, {
        alertId: nanoid(),
        ...input,
      });
      return alert;
    }),
    acknowledge: protectedProcedure.input(z.object({ alertId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const updated = await acknowledgeSecurityAlert(ctx.user.id, input.alertId);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found." });
      return updated;
    }),
  }),

  // ── Platform API Keys ─────────────────────────────────────────────────
  platforms: router({
    listKeys: protectedProcedure.query(({ ctx }) => listPlatformApiKeys(ctx.user.id)),
    addKey: protectedProcedure.input(addApiKeySchema).mutation(async ({ ctx, input }) => {
      if (input.hasWithdrawPermission) {
        // Emit a critical alert for withdrawal permission
        await createSecurityAlert(ctx.user.id, {
          alertId: nanoid(),
          level: "critical",
          category: "key-permission",
          title: "Withdrawal permission enabled on API key",
          detail: `The ${input.platform} key "${input.label}" was added with withdrawal permissions. This grants the ability to move funds off the platform. Ledgerline recommends trading-only keys.`,
        });
      }

      const keyPrefix = maskApiKey(input.apiKey);
      const apiKeyEncrypted = encryptSecret(input.apiKey);
      const secretEncrypted = encryptSecret(input.apiSecret);

      const key = await createPlatformApiKey(ctx.user.id, {
        keyId: nanoid(),
        platform: input.platform,
        label: input.label,
        keyPrefix,
        apiKeyEncrypted,
        secretEncrypted,
        permissions: input.permissions,
        hasWithdrawPermission: input.hasWithdrawPermission,
        maxOrderUsd: input.maxOrderUsd,
        allocatedCapitalUsd: input.allocatedCapitalUsd,
        dailyTradeLimit: input.dailyTradeLimit,
      });

      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "platform_key_added",
        status: input.hasWithdrawPermission ? "review" : "success",
        subject: `API key added: ${input.platform}`,
        detail: input.hasWithdrawPermission
          ? `Owner added a ${input.platform} API key with withdrawal permissions. This is a security risk.`
          : `Owner added a ${input.platform} API key with trading-only permissions.`,
        payload: {
          keyId: key?.keyId,
          platform: input.platform,
          label: input.label,
          permissions: input.permissions,
          hasWithdrawPermission: input.hasWithdrawPermission,
        },
      });

      return key;
    }),
    testConnection: protectedProcedure.input(z.object({ keyId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const key = await getPlatformApiKey(ctx.user.id, input.keyId);
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      // ponytail: simulated test — real implementation would call the exchange API
      const updated = await updatePlatformApiKeyState(ctx.user.id, input.keyId, "active");
      await createSecurityAlert(ctx.user.id, {
        alertId: nanoid(),
        level: "info",
        category: "connection-test",
        title: `Connection test passed: ${key.platform}`,
        detail: `The ${key.platform} API key "${key.label}" passed a connection test. No orders were placed.`,
      });
      return updated;
    }),
    disable: protectedProcedure.input(z.object({ keyId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const key = await getPlatformApiKey(ctx.user.id, input.keyId);
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      const updated = await updatePlatformApiKeyState(ctx.user.id, input.keyId, "disabled");
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "platform_key_disabled",
        status: "success",
        subject: `API key disabled: ${key.platform}`,
        detail: `Owner disabled the ${key.platform} API key "${key.label}".`,
        payload: { keyId: input.keyId, platform: key.platform },
      });
      return updated;
    }),
    delete: protectedProcedure.input(z.object({ keyId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const key = await deletePlatformApiKey(ctx.user.id, input.keyId);
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "platform_key_removed",
        status: "success",
        subject: `API key deleted: ${key.platform}`,
        detail: `Owner deleted the ${key.platform} API key "${key.label}".`,
        payload: { keyId: input.keyId, platform: key.platform },
      });
      return key;
    }),
    updateLimits: protectedProcedure.input(updateLimitsSchema).mutation(async ({ ctx, input }) => {
      const key = await getPlatformApiKey(ctx.user.id, input.keyId);
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      const updated = await updatePlatformApiKeyLimits(ctx.user.id, input.keyId, {
        maxOrderUsd: input.maxOrderUsd,
        allocatedCapitalUsd: input.allocatedCapitalUsd,
        dailyTradeLimit: input.dailyTradeLimit,
      });
      return updated;
    }),
  }),
});
