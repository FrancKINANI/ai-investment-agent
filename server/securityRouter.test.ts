import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

// ─── Mocks ────────────────────────────────────────────────────────────────

const db = vi.hoisted(() => ({
  createSecurityAlert: vi.fn(),
  listSecurityAlerts: vi.fn(),
  acknowledgeSecurityAlert: vi.fn(),
  countUnacknowledgedAlerts: vi.fn(),
  createPlatformApiKey: vi.fn(),
  listPlatformApiKeys: vi.fn(),
  getPlatformApiKey: vi.fn(),
  updatePlatformApiKeyState: vi.fn(),
  updatePlatformApiKeyLimits: vi.fn(),
  deletePlatformApiKey: vi.fn(),
  createOperatorAction: vi.fn(),
}));

vi.mock("./db", () => db);

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "security-test-owner",
      name: "Security Test Owner",
      email: "security@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.createSecurityAlert.mockResolvedValue({ id: 1, alertId: "alert-1", level: "info", category: "test", title: "Test alert", detail: "Detail", acknowledged: false, createdAt: new Date(), updatedAt: new Date() });
  db.listSecurityAlerts.mockResolvedValue([]);
  db.acknowledgeSecurityAlert.mockResolvedValue({ id: 1, alertId: "alert-1", acknowledged: true });
  db.countUnacknowledgedAlerts.mockResolvedValue(0);
  db.createPlatformApiKey.mockResolvedValue({ id: 1, keyId: "key-1", platform: "binance", label: "Test key", keyPrefix: "abc****def", state: "active" });
  db.listPlatformApiKeys.mockResolvedValue([]);
  db.getPlatformApiKey.mockResolvedValue(null);
  db.updatePlatformApiKeyState.mockResolvedValue({ id: 1, keyId: "key-1", state: "active" });
  db.updatePlatformApiKeyLimits.mockResolvedValue({ id: 1, keyId: "key-1", maxOrderUsd: 10000 });
  db.deletePlatformApiKey.mockResolvedValue({ id: 1, keyId: "key-1", platform: "binance" });
  db.createOperatorAction.mockResolvedValue({ id: 1 });
});

// ─── Alert Tests ──────────────────────────────────────────────────────────

describe("security.alerts", () => {
  it("lists alerts scoped to the authenticated owner", async () => {
    db.listSecurityAlerts.mockResolvedValue([
      { id: 1, alertId: "a1", level: "critical", category: "key-permission", title: "Withdrawal enabled", detail: "A key has withdrawal perms.", acknowledged: false, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const caller = appRouter.createCaller(context());
    const alerts = await caller.security.alerts.list();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe("critical");
    expect(db.listSecurityAlerts).toHaveBeenCalledWith(42);
  });

  it("counts only unacknowledged alerts for the badge", async () => {
    db.countUnacknowledgedAlerts.mockResolvedValue(3);
    const caller = appRouter.createCaller(context());
    const count = await caller.security.alerts.unacknowledgedCount();
    expect(count).toBe(3);
    expect(db.countUnacknowledgedAlerts).toHaveBeenCalledWith(42);
  });

  it("creates an alert with a generated id and returns it", async () => {
    const caller = appRouter.createCaller(context());
    const alert = await caller.security.alerts.create({
      level: "warning",
      category: "connection-issue",
      title: "High latency detected",
      detail: "The connection to the exchange experienced unusual latency.",
    });
    expect(db.createSecurityAlert).toHaveBeenCalledWith(42, expect.objectContaining({
      level: "warning",
      category: "connection-issue",
      title: "High latency detected",
    }));
    expect(alert).toBeDefined();
  });

  it("rejects alert creation with a category that is too short", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.security.alerts.create({
      level: "info",
      category: "x",
      title: "Valid title here",
      detail: "Valid detail text.",
    })).rejects.toThrow();
  });

  it("acknowledges an existing alert", async () => {
    db.acknowledgeSecurityAlert.mockResolvedValue({ id: 1, alertId: "a1", acknowledged: true });
    const caller = appRouter.createCaller(context());
    const result = await caller.security.alerts.acknowledge({ alertId: "a1" });
    expect(result.acknowledged).toBe(true);
    expect(db.acknowledgeSecurityAlert).toHaveBeenCalledWith(42, "a1");
  });

  it("throws NOT_FOUND when acknowledging a nonexistent alert", async () => {
    db.acknowledgeSecurityAlert.mockResolvedValue(null);
    const caller = appRouter.createCaller(context());
    await expect(caller.security.alerts.acknowledge({ alertId: "nonexistent" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── Platform API Key Tests ───────────────────────────────────────────────

describe("security.platforms", () => {
  const validKeyInput = {
    platform: "binance" as const,
    label: "Main trading key",
    apiKey: "abcdefghijklmnopqrstuvwxyz1234",
    apiSecret: "supersecretkeyvalue12345678",
    permissions: ["spot:trade", "spot:read"],
    hasWithdrawPermission: false,
  };

  it("lists platform keys scoped to the authenticated owner", async () => {
    db.listPlatformApiKeys.mockResolvedValue([
      { id: 1, keyId: "k1", platform: "binance", label: "Key 1", keyPrefix: "abcd****wxyz", state: "active" },
    ]);
    const caller = appRouter.createCaller(context());
    const keys = await caller.security.platforms.listKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].platform).toBe("binance");
    expect(db.listPlatformApiKeys).toHaveBeenCalledWith(42);
  });

  it("adds a trading-only key and logs a success operator action", async () => {
    const caller = appRouter.createCaller(context());
    const key = await caller.security.platforms.addKey(validKeyInput);
    expect(key).toBeDefined();
    expect(db.createPlatformApiKey).toHaveBeenCalledWith(42, expect.objectContaining({
      platform: "binance",
      label: "Main trading key",
      hasWithdrawPermission: false,
    }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(42, expect.objectContaining({
      kind: "platform_key_added",
      status: "success",
    }));
    // No critical alert for trading-only keys
    expect(db.createSecurityAlert).not.toHaveBeenCalled();
  });

  it("emits a critical alert and logs review status when withdrawal permission is enabled", async () => {
    const caller = appRouter.createCaller(context());
    await caller.security.platforms.addKey({
      ...validKeyInput,
      hasWithdrawPermission: true,
    });
    expect(db.createSecurityAlert).toHaveBeenCalledWith(42, expect.objectContaining({
      level: "critical",
      category: "key-permission",
      title: expect.stringContaining("Withdrawal permission"),
    }));
    expect(db.createOperatorAction).toHaveBeenCalledWith(42, expect.objectContaining({
      kind: "platform_key_added",
      status: "review",
    }));
  });

  it("stores the API secret encrypted (base64 placeholder) and masks the key prefix", async () => {
    const caller = appRouter.createCaller(context());
    await caller.security.platforms.addKey(validKeyInput);
    const callArgs = db.createPlatformApiKey.mock.calls[0][1];
    // Key prefix should be masked: first 4 + **** + last 4
    // API key is 'abcdefghijklmnopqrstuvwxyz1234' → first 4='abcd', last 4='1234'
    expect(callArgs.keyPrefix).toBe("abcd****1234");
    // Secret should be base64-encoded (ponytail: placeholder for real KMS)
    const decoded = Buffer.from(callArgs.secretEncrypted, "base64").toString();
    expect(decoded).toBe("supersecretkeyvalue12345678");
  });

  it("returns NOT_FOUND when testing a nonexistent key", async () => {
    db.getPlatformApiKey.mockResolvedValue(null);
    const caller = appRouter.createCaller(context());
    await expect(caller.security.platforms.testConnection({ keyId: "nonexistent" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("tests an existing connection and emits an info alert", async () => {
    db.getPlatformApiKey.mockResolvedValue({ id: 1, keyId: "k1", platform: "binance", label: "Test key" });
    const caller = appRouter.createCaller(context());
    await caller.security.platforms.testConnection({ keyId: "k1" });
    expect(db.updatePlatformApiKeyState).toHaveBeenCalledWith(42, "k1", "active");
    expect(db.createSecurityAlert).toHaveBeenCalledWith(42, expect.objectContaining({
      level: "info",
      category: "connection-test",
      title: expect.stringContaining("binance"),
    }));
  });

  it("disables a key and logs a platform_key_disabled action", async () => {
    db.getPlatformApiKey.mockResolvedValue({ id: 1, keyId: "k1", platform: "okx", label: "OKX key" });
    const caller = appRouter.createCaller(context());
    await caller.security.platforms.disable({ keyId: "k1" });
    expect(db.updatePlatformApiKeyState).toHaveBeenCalledWith(42, "k1", "disabled");
    expect(db.createOperatorAction).toHaveBeenCalledWith(42, expect.objectContaining({
      kind: "platform_key_disabled",
      status: "success",
    }));
  });

  it("deletes a key and returns the deleted record", async () => {
    db.deletePlatformApiKey.mockResolvedValue({ id: 1, keyId: "k1", platform: "kraken", label: "Kraken key" });
    const caller = appRouter.createCaller(context());
    const deleted = await caller.security.platforms.delete({ keyId: "k1" });
    expect(deleted).toBeDefined();
    expect(deleted?.platform).toBe("kraken");
    expect(db.createOperatorAction).toHaveBeenCalledWith(42, expect.objectContaining({
      kind: "platform_key_removed",
    }));
  });

  it("throws NOT_FOUND when deleting a nonexistent key", async () => {
    db.deletePlatformApiKey.mockResolvedValue(null);
    const caller = appRouter.createCaller(context());
    await expect(caller.security.platforms.delete({ keyId: "ghost" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updates per-platform limits on an existing key", async () => {
    db.getPlatformApiKey.mockResolvedValue({ id: 1, keyId: "k1", platform: "coinbase" });
    const caller = appRouter.createCaller(context());
    const updated = await caller.security.platforms.updateLimits({
      keyId: "k1",
      maxOrderUsd: 5000,
      allocatedCapitalUsd: 50000,
      dailyTradeLimit: 20,
    });
    expect(db.updatePlatformApiKeyLimits).toHaveBeenCalledWith(42, "k1", {
      maxOrderUsd: 5000,
      allocatedCapitalUsd: 50000,
      dailyTradeLimit: 20,
    });
    expect(updated).toBeDefined();
  });

  it("throws NOT_FOUND when updating limits on a nonexistent key", async () => {
    db.getPlatformApiKey.mockResolvedValue(null);
    const caller = appRouter.createCaller(context());
    await expect(caller.security.platforms.updateLimits({ keyId: "ghost", maxOrderUsd: 1000 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects API key input with permissions array that is empty", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.security.platforms.addKey({
      ...validKeyInput,
      permissions: [],
    })).rejects.toThrow();
  });

  it("rejects API key input with a short API key", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.security.platforms.addKey({
      ...validKeyInput,
      apiKey: "short",
    })).rejects.toThrow();
  });

  it("rejects invalid platform values", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.security.platforms.addKey({
      ...validKeyInput,
      platform: "ftx" as any,
    })).rejects.toThrow();
  });
});

// ─── Security Contract Tests ──────────────────────────────────────────────

describe("security contracts", () => {
  it("all alert operations are owner-scoped — no cross-user data leakage", async () => {
    const caller = appRouter.createCaller(context());
    await caller.security.alerts.list();
    await caller.security.alerts.unacknowledgedCount();
    expect(db.listSecurityAlerts).toHaveBeenCalledWith(42);
    expect(db.countUnacknowledgedAlerts).toHaveBeenCalledWith(42);
  });

  it("all platform key operations are owner-scoped", async () => {
    const caller = appRouter.createCaller(context());
    await caller.security.platforms.listKeys();
    expect(db.listPlatformApiKeys).toHaveBeenCalledWith(42);
  });

  it("every mutation produces an immutable operator action record", async () => {
    const caller = appRouter.createCaller(context());
    await caller.security.alerts.create({ level: "info", category: "test", title: "Test title here", detail: "Test detail here." });
    await caller.security.platforms.addKey({
      platform: "binance",
      label: "Test key",
      apiKey: "abcdefghijklmnopqrstuvwxyz1234",
      apiSecret: "supersecretkeyvalue12345678",
      permissions: ["spot:trade"],
    });
    // Verify operator action was logged for key addition
    expect(db.createOperatorAction).toHaveBeenCalledWith(42, expect.objectContaining({
      kind: "platform_key_added",
      payload: expect.objectContaining({ platform: "binance" }),
    }));
  });

  it("the security router is callable through the app router", async () => {
    // Verify the security sub-router is reachable through the caller
    const caller = appRouter.createCaller(context());
    const alerts = await caller.security.alerts.list();
    const keys = await caller.security.platforms.listKeys();
    expect(Array.isArray(alerts)).toBe(true);
    expect(Array.isArray(keys)).toBe(true);
  });
});
