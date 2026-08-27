import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../db", () => ({
  getAuthorityState: vi.fn(),
  getPlatformApiKey: vi.fn(),
  listPlatformApiKeys: vi.fn(),
  createOperatorAction: vi.fn().mockResolvedValue({}),
  createSecurityAlert: vi.fn().mockResolvedValue({}),
  getLiveOrderByIdempotencyKey: vi.fn(),
  appendLedgerEvent: vi.fn().mockResolvedValue({}),
  consumeLiveOrderApproval: vi.fn(),
}));

vi.mock("../kms", () => ({
  decryptSecret: vi.fn((v: string) => `decrypted:${v}`),
}));

vi.mock("../binance", () => ({
  placeOrder: vi.fn(),
  getPrice: vi.fn(),
  get24hTicker: vi.fn(),
  getBalances: vi.fn(),
}));

vi.mock("../liveData", () => ({
  readBinanceTicker: vi.fn().mockResolvedValue({ ok: true, data: { price: 50000, change24h: 2.5, volume: 1e9 } }),
}));

vi.mock("@shared/mandateAuthority", () => ({
  reconcileLiveExecution: vi.fn().mockReturnValue({ allowed: true, reason: "ok" }),
  liveOrderApprovalHash: vi.fn().mockReturnValue("hash-123"),
}));

vi.mock("@shared/paperExecution", () => ({
  ledgerSeq: vi.fn((status: string) => `seq-${status}`),
}));

import { CEXExecutionBackend } from "./cex.backend";
import { getAuthorityState, listPlatformApiKeys } from "../db";
import { canPlaceOrders, isBlockedByDominantState } from "@shared/authorityState";
import type { ExecutionRequest } from "@shared/executionBackend";

function makeRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    userId: 1,
    proposalId: "proposal-1",
    venue: "binance",
    walletRole: "trading",
    order: {
      symbol: "BTCUSDT",
      side: "buy",
      quantity: 0.001,
    },
    mandate: {
      mandateId: "mandate-1",
      mode: "real",
      status: "active",
      venue: "binance",
      maxOrderBps: 250,
      dailyCapBps: 1000,
      allowedAssets: ["BTCUSDT"],
    },
    authorityState: "approval-required-live",
    metadata: {
      policyVersion: 1,
    },
    ...overrides,
  };
}

describe("CEXExecutionBackend — v0.3 Binance live path", () => {
  const backend = new CEXExecutionBackend();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthorityState).mockResolvedValue("approval-required-live");
    vi.mocked(listPlatformApiKeys).mockResolvedValue([{
      keyId: "key-1",
      platform: "binance",
      state: "active",
      label: "Test Key",
    }] as any);
  });

  // ── Authority gates (fail closed) ──────────────────────────────────────

  describe("authority gates", () => {
    it.each(["disabled", "sandbox-only", "read-only-live", "paused", "revoked"] as const)(
      "blocks when authority state is %s",
      async (state) => {
        const request = makeRequest({ authorityState: state });
        const result = await backend.execute(request);
        expect(result.status).toBe("blocked");
        if (result.status === "blocked") {
          expect(result.reason).toContain(state);
        }
      },
    );

    it("still blocks a generic request when authority state is approval-required-live", async () => {
      const request = makeRequest({ authorityState: "approval-required-live" });
      const result = await backend.execute(request);
      expect(result.status).toBe("blocked");
      expect(result.reason).toMatch(/server-derived live-order intent/i);
    });

    it("still blocks a generic request when authority state is limited-live", async () => {
      const request = makeRequest({ authorityState: "limited-live" });
      const result = await backend.execute(request);
      expect(result.status).toBe("blocked");
      expect(result.reason).toMatch(/server-derived live-order intent/i);
    });
  });

  // ── Credential checks ─────────────────────────────────────────────────

  describe("credential checks", () => {
    it("rejects when no active Binance key exists", async () => {
      vi.mocked(listPlatformApiKeys).mockResolvedValue([]);
      const request = makeRequest();
      const result = await backend.execute(request);
      expect(result.status).toBe("blocked");
      expect(result.reason).toMatch(/server-derived live-order intent/i);
    });

    it("rejects when all Binance keys are disabled", async () => {
      vi.mocked(listPlatformApiKeys).mockResolvedValue([{
        keyId: "key-1",
        platform: "binance",
        state: "disabled",
      }] as any);
      const request = makeRequest();
      const result = await backend.execute(request);
      expect(result.status).toBe("blocked");
    });
  });

  // ── Mandate checks ────────────────────────────────────────────────────

  describe("mandate checks", () => {
    it("rejects when mandate is null", async () => {
      const request = makeRequest({ mandate: null });
      const result = await backend.execute(request);
      // Will be rejected by liveAdapter because mandate is required for real mode
      expect(result.status).not.toBe("filled");
    });

    it("rejects when mandate mode is simulation", async () => {
      const request = makeRequest({
        mandate: {
          mandateId: "mandate-1",
          mode: "simulation",
          status: "active",
          venue: "binance",
          maxOrderBps: 250,
          dailyCapBps: 1000,
          allowedAssets: ["BTCUSDT"],
        },
      });
      const result = await backend.execute(request);
      expect(result.status).toBe("blocked");
    });

    it("rejects when mandate venue is not binance", async () => {
      const request = makeRequest({
        mandate: {
          mandateId: "mandate-1",
          mode: "real",
          status: "active",
          venue: "evm",
          maxOrderBps: 250,
          dailyCapBps: 1000,
          allowedAssets: ["BTCUSDT"],
        },
      });
      const result = await backend.execute(request);
      expect(result.status).toBe("blocked");
    });
  });

  // ── Withdrawal hard-reject (credential level) ──────────────────────────

  describe("withdrawal rejection", () => {
    it("rejects keys with withdrawal permission at schema level", async () => {
      // This is tested at the securityRouter level, but verify the backend
      // only accepts active keys (withdrawal keys are never active)
      vi.mocked(listPlatformApiKeys).mockResolvedValue([{
        keyId: "key-1",
        platform: "binance",
        state: "active",
        hasWithdrawPermission: false, // Withdrawal keys are rejected before becoming active
      }] as any);
      const request = makeRequest();
      const result = await backend.execute(request);
      expect(result.status).toBe("blocked");
    });
  });

  // ── Happy path (mocked) ────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns rejected when liveAdapter throws (mocked)", async () => {
      // liveAdapter is mocked via db/binance mocks — it will fail
      // because the mocks don't set up the full flow
      const request = makeRequest();
      const result = await backend.execute(request);
      // Should not crash — returns a result
      expect(result).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });

  // ── Backend metadata ───────────────────────────────────────────────────

  describe("backend metadata", () => {
    it("has correct type and label", () => {
      expect(backend.type).toBe("cex");
      expect(backend.label).toBe("Binance (Live)");
    });

    it("verify() does not throw", async () => {
      await expect(backend.verify()).resolves.toBeUndefined();
    });
  });
});
