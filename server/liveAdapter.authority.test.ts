import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getAuthorityState: vi.fn(),
  getAuthoritySnapshot: vi.fn(),
  getPlatformApiKey: vi.fn(),
  listWalletMandates: vi.fn(),
  getLiveOrderByIdempotencyKey: vi.fn(),
  claimLiveOrderIntent: vi.fn(),
  reserveLiveDailyRisk: vi.fn(),
  updateLiveOrderIntentStatus: vi.fn(),
  consumeLiveOrderApproval: vi.fn(),
  appendLedgerEvent: vi.fn(),
  createOperatorAction: vi.fn().mockResolvedValue({}),
  createSecurityAlert: vi.fn().mockResolvedValue({}),
}));
vi.mock("./kms", () => ({ decryptSecret: vi.fn((v: string) => `decrypted:${v}`) }));
vi.mock("./binance", () => ({ placeOrder: vi.fn(), cancelOrder: vi.fn() }));

import { executeLiveOrder } from "./liveAdapter";
import { getAuthoritySnapshot, listWalletMandates } from "./db";
import { AuthorityBlockedError } from "@shared/authorityState";
import type { ServerDerivedLiveOrderIntent } from "./liveOrderIntent";

const mandate = {
  mandateId: "mandate-1", mode: "real", status: "active", venue: "binance",
  maxOrderBps: 250, dailyCapBps: 1000, allowedAssets: ["BTCUSDT"], version: 1,
};

function makeIntent(overrides: Partial<ServerDerivedLiveOrderIntent> = {}): ServerDerivedLiveOrderIntent {
  return {
    executionMode: "live", venue: "binance", platformKeyId: "key-1", keyVersion: 1,
    mandateId: "mandate-1", mandateVersion: 1, authorityState: "limited-live", authorityVersion: 1,
    approvalExpiresAtMs: Date.now() + 60_000,
    order: { symbol: "BTCUSDT", side: "BUY", type: "MARKET", quantity: null, quoteOrderQty: 100, price: null, timeInForce: "GTC" },
    verifiedBalance: { availableUsd: 10_000, source: "binance-account", observedAtMs: Date.now() },
    idempotencyKey: "live_server_generated_idempotency_key",
    ...overrides,
  };
}

describe("executeLiveOrder authority gate (fail closed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listWalletMandates).mockResolvedValue([mandate] as never);
  });

  it.each(["disabled", "sandbox-only", "read-only-live", "paused", "revoked"] as const)(
    "blocks orders when authority state is %s before consulting the mandate",
    async (state) => {
      vi.mocked(getAuthoritySnapshot).mockResolvedValue({ state, version: 1 });
      await expect(executeLiveOrder(1, makeIntent({ authorityState: state }))).rejects.toThrow(AuthorityBlockedError);
      expect(listWalletMandates).not.toHaveBeenCalled();
    },
  );

  it("blocks a stale authority version before venue logic", async () => {
    vi.mocked(getAuthoritySnapshot).mockResolvedValue({ state: "limited-live", version: 2 });
    await expect(executeLiveOrder(1, makeIntent())).rejects.toThrow(/authority state is stale/i);
    expect(listWalletMandates).not.toHaveBeenCalled();
  });
});
