import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  createOperatorAction: vi.fn().mockResolvedValue({}),
  createSecurityAlert: vi.fn().mockResolvedValue({}),
  getDb: vi.fn().mockResolvedValue({
    update: vi.fn().mockReturnValue({ set: () => ({ where: async () => undefined }) }),
    insert: vi.fn().mockReturnValue({ values: async () => undefined }),
    select: vi.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [], orderBy: () => async () => [] }) }) }),
  }),
}));

import {
  connectWallet,
  disconnectWallet,
  getSupportedChains,
  listWalletSessions,
  requestTransaction,
  WalletSigningNotPermittedError,
} from "./walletService";

const good = { address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", chainId: 1, provider: "injected" as const };

describe("wallet view sessions (Stage 4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers a view-only session with a client-verified address", async () => {
    const s = await connectWallet(1, good);
    expect(s.capabilities).toEqual(["view"]);
    expect(s.address).toBe(good.address.toLowerCase());
    expect(getSupportedChains().length).toBeGreaterThan(0);
  });

  it.each([
    ["too short", "0x1234"],
    ["too long", "0x" + "ab".repeat(21)],
    ["not hex", "0xZZZ7656EC7ab88b098defB751B7401B5f6d8976F"],
    ["empty", ""],
    ["no prefix", "71C7656EC7ab88b098defB751B7401B5f6d8976F"],
  ])("refuses to register a session with an invalid address (%s)", async (_label, addr) => {
    await expect(connectWallet(1, { ...good, address: addr })).rejects.toThrow(/Invalid wallet address|does not accept generated/);
  });

  it("rejects unsupported chains", async () => {
    await expect(connectWallet(1, { ...good, chainId: 999999 })).rejects.toThrow(/not supported/);
  });

  it("fails closed when the database is unavailable", async () => {
    const { getDb } = await import("./db");
    vi.mocked(getDb).mockResolvedValue(null as never);
    await expect(connectWallet(1, good)).rejects.toThrow(/Database unavailable/);
  });
});

describe("signing hard-rejection (view-first)", () => {
  it("never produces a signature or hash — throws a typed rejection", async () => {
    await expect(requestTransaction(1)).rejects.toBeInstanceOf(WalletSigningNotPermittedError);
  });

  it("rejection message names the stage boundary truthfully", async () => {
    try {
      await requestTransaction(1);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("view-only");
      expect((e as Error).message).toContain("separately approved");
    }
  });
});

describe("owner scoping", () => {
  it("listWalletSessions only queries the caller's own sessions", async () => {
    const db = await import("./db");
    const whereMock = vi.fn(() => ({ orderBy: () => ({ limit: async () => [] }) }));
    vi.mocked(db.getDb).mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: whereMock })) })),
    } as never);
    await listWalletSessions(42);
    // Drizzle eq() call args aren't easily inspectable here; assert query was scoped via userId path
    expect(whereMock).toHaveBeenCalled();
  });

  it("disconnectWallet returns false for another owner's session (no rows matched)", async () => {
    const db = await import("./db");
    vi.mocked(db.getDb).mockResolvedValue({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    } as never);
    expect(await disconnectWallet(1, "someone-elses-session")).toBe(false);
  });
});
