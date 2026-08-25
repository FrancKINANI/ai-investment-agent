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

/**
 * Credential venues permitted for ingestion (Stage 3 discipline: one venue first).
 * Expanding this list is an explicit owner decision, not a code convenience.
 */
export const ACTIVE_CREDENTIAL_VENUES = ["binance"] as const;

/**
 * Allowlist of safe key scopes accepted at ingestion. Anything outside this
 * list — especially withdrawal/transfer scopes — is hard-rejected before storage.
 */
const SAFE_KEY_SCOPES = ["spot:read", "spot:trade"] as const;

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
}).superRefine((data, ctx) => {
  // Hard-reject dangerous scopes at the type boundary (spec non-negotiable #5).
  for (const p of data.permissions) {
    if (!(SAFE_KEY_SCOPES as readonly string[]).includes(p)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["permissions"], message: `Scope "${p}" is not in the safe allowlist (${SAFE_KEY_SCOPES.join(", ")}). Withdrawal and transfer scopes are never accepted.` });
    }
  }
});

const updateLimitsSchema = z.object({
  keyId: z.string().trim().min(1).max(64),
  maxOrderUsd: z.number().int().positive().max(10_000_000).optional(),
  allocatedCapitalUsd: z.number().int().positive().max(100_000_000).optional(),
  dailyTradeLimit: z.number().int().positive().max(100_000).optional(),
});

import { encryptSecret, maskApiKey } from "./kms";
import { decryptSecret } from "./kms";
import * as binance from "./binance";

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
      // Hard-reject withdrawal authority. Never stored, never "saved with alert".
      if (input.hasWithdrawPermission) {
        await createSecurityAlert(ctx.user.id, {
          alertId: nanoid(),
          level: "critical",
          category: "key-permission",
          title: "Withdrawal-scoped API key rejected",
          detail: `An attempt to add the ${input.platform} key "${input.label}" with withdrawal permission was rejected. Ledgerline hard-rejects withdrawal and transfer scopes; nothing was stored.`,
        });
        throw new TRPCError({ code: "FORBIDDEN", message: "Withdrawal-scoped API keys are hard-rejected by Ledgerline policy. Create a trading-only key without withdrawal permissions." });
      }

      // Stage 3 discipline: one venue at a time.
      if (!(ACTIVE_CREDENTIAL_VENUES as readonly string[]).includes(input.platform)) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Credential ingestion is currently limited to: ${ACTIVE_CREDENTIAL_VENUES.join(", ")}. Enabling another venue is an explicit owner decision.` });
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
        hasWithdrawPermission: false,
        maxOrderUsd: input.maxOrderUsd,
        allocatedCapitalUsd: input.allocatedCapitalUsd,
        dailyTradeLimit: input.dailyTradeLimit,
      });

      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "platform_key_added",
        status: "success",
        subject: `API key added: ${input.platform}`,
        detail: `Owner added a ${input.platform} API key with scopes: ${input.permissions.join(", ")}.`,
        payload: {
          keyId: key?.keyId,
          platform: input.platform,
          label: input.label,
          permissions: input.permissions,
        },
      });

      return key;
    }),
    testConnection: protectedProcedure.input(z.object({ keyId: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      const key = await getPlatformApiKey(ctx.user.id, input.keyId);
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });

      // Real verification against the venue's read-only signed endpoint.
      // No fake "passed" results: failure is reported truthfully and the key
      // is marked disabled so downstream execution paths fail closed.
      if (key.platform === "binance") {
        try {
          await binance.getAccount(decryptSecret(key.apiKeyEncrypted), decryptSecret(key.secretEncrypted));
          const updated = await updatePlatformApiKeyState(ctx.user.id, input.keyId, "active");
          await createSecurityAlert(ctx.user.id, {
            alertId: nanoid(),
            level: "info",
            category: "connection-test",
            title: `Connection verified: ${key.platform}`,
            detail: `The ${key.platform} API key "${key.label}" authenticated successfully against the read-only account endpoint. No orders were placed.`,
          });
          return updated;
        } catch (error) {
          await updatePlatformApiKeyState(ctx.user.id, input.keyId, "disabled");
          await createSecurityAlert(ctx.user.id, {
            alertId: nanoid(),
            level: "warning",
            category: "connection-test",
            title: `Connection verification FAILED: ${key.platform}`,
            detail: `The ${key.platform} API key "${key.label}" failed verification: ${error instanceof Error ? error.message : "unknown error"}. The key has been disabled; fix or rotate it before use.`,
          });
          throw new TRPCError({ code: "BAD_REQUEST", message: `Connection verification failed for ${key.label}: the key was NOT verified and has been disabled.` });
        }
      }

      // Non-binance venues: honest refusal instead of a fake pass.
      throw new TRPCError({ code: "BAD_REQUEST", message: `Automated credential verification for ${key.platform} is not implemented. The key state is unchanged and must be considered unverified.` });
    }),

    /** Rotation: replace key material in place; old secrets are overwritten atomically. */
    rotate: protectedProcedure.input(z.object({
      keyId: z.string().trim().min(1).max(64),
      apiKey: z.string().trim().min(8).max(200),
      apiSecret: z.string().trim().min(8).max(200),
    })).mutation(async ({ ctx, input }) => {
      const existing = await getPlatformApiKey(ctx.user.id, input.keyId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      if (!(ACTIVE_CREDENTIAL_VENUES as readonly string[]).includes(existing.platform)) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Rotation currently limited to: ${ACTIVE_CREDENTIAL_VENUES.join(", ")}.` });
      }
      const { updatePlatformApiKeyMaterial } = await import("./db");
      const updated = await updatePlatformApiKeyMaterial(ctx.user.id, input.keyId, {
        apiKeyEncrypted: encryptSecret(input.apiKey),
        secretEncrypted: encryptSecret(input.apiSecret),
        keyPrefix: maskApiKey(input.apiKey),
      });
      await createOperatorAction(ctx.user.id, {
        actionId: nanoid(),
        kind: "platform_key_disabled", // reuse audited kind family for credential events
        status: "success",
        subject: `API key rotated: ${existing.platform}`,
        detail: `Owner rotated the ${existing.platform} API key "${existing.label}". Previous material overwritten. Key requires re-verification.`,
        payload: { keyId: input.keyId, platform: existing.platform },
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
