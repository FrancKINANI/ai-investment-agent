import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getAuthorityState: vi.fn(),
  getPlatformApiKey: vi.fn(),
  createOperatorAction: vi.fn().mockResolvedValue({}),
  createSecurityAlert: vi.fn().mockResolvedValue({}),
}));
vi.mock("./kms", () => ({ decryptSecret: vi.fn((v: string) => `decrypted:${v}`) }));
vi.mock("./binance", () => ({
  placeOrder: vi.fn(),
}));

import { executeLiveOrder, type LiveOrderRequest } from "./liveAdapter";
import { getAuthorityState } from "./db";
import { AuthorityBlockedError } from "@shared/authorityState";

const mandate = {
  mandateId: "mandate-1",
  mode: "real",
  status: "active",
  venue: "binance",
  maxOrderBps: 250,
  dailyCapBps: 1000,
  allowedAssets: ["BTCUSDT"],
};

const order: LiveOrderRequest = {
  symbol: "BTCUSDT",
  side: "BUY",
  type: "MARKET",
  quoteOrderQty: 100,
};

describe("executeLiveOrder authority gate (fail closed)", () => {
  beforeEach(() => {
    vi.mocked(getAuthorityState).mockReset();
    vi.mocked(getAuthorityState).mockResolvedValue("limited-live");
  });

  it.each(["disabled", "sandbox-only", "read-only-live", "paused", "revoked"] as const)(
    "blocks orders when authority state is %s — even with an active real mandate",
    async (state) => {
      vi.mocked(getAuthorityState).mockResolvedValue(state);
      await expect(executeLiveOrder(1, "key-1", mandate, order, 10_000)).rejects.toThrow(AuthorityBlockedError);
    },
  );

  it("does not consult the mandate before the authority gate blocks", async () => {
    vi.mocked(getAuthorityState).mockResolvedValue("revoked");
    await expect(executeLiveOrder(1, "key-1", null, order, 10_000)).rejects.toThrow(AuthorityBlockedError);
  });

  it("proceeds past the authority gate in limited-live (Stage 5 idempotency requirement surfaces next)", async () => {
    vi.mocked(getAuthorityState).mockResolvedValue("limited-live");
    await expect(executeLiveOrder(1, "key-1", { ...mandate, mode: "real" }, order, 10_000)).rejects.toThrow(
      /Live orders require a caller-supplied idempotencyKey/,
    );
  });
});
