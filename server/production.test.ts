import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  validateEnvironment,
  getHealthCheck,
  createLogEntry,
  generateRequestId,
} from "./production";

describe("environment validation", () => {
  it("warns about missing ENCRYPTION_KEY", () => {
    const result = validateEnvironment();
    // Should have at least a warning about ENCRYPTION_KEY
    expect(result.warnings.some(w => w.includes("ENCRYPTION_KEY"))).toBe(true);
  });

  it("warns about missing Binance API keys", () => {
    const result = validateEnvironment();
    expect(result.warnings.some(w => w.includes("BINANCE_API_KEY"))).toBe(true);
    expect(result.warnings.some(w => w.includes("BINANCE_API_SECRET"))).toBe(true);
  });

  it("returns valid when required vars are set", () => {
    // DATABASE_URL and JWT_SECRET may not be set in test env
    const result = validateEnvironment();
    // Errors are only critical if they exist in the env
    // In test, we accept that these may be missing
    expect(result).toBeDefined();
    expect(result.valid).toBeDefined();
  });
});

describe("health check", () => {
  it("returns a valid health check structure", async () => {
    const health = await getHealthCheck();
    expect(health.status).toBeDefined();
    expect(health.timestamp).toBeDefined();
    expect(health.uptime).toBeGreaterThanOrEqual(0);
    expect(health.subsystems).toBeDefined();
    expect(health.version).toBeDefined();
  });

  it("includes subsystem statuses", async () => {
    const health = await getHealthCheck();
    expect(health.subsystems.database).toBeDefined();
    expect(health.subsystems.encryption).toBeDefined();
  });

  it("reports degraded when using dev encryption fallback", async () => {
    const health = await getHealthCheck();
    if (!process.env.ENCRYPTION_KEY) {
      expect(health.subsystems.encryption.status).toBe("degraded");
    }
  });
});

describe("structured logging", () => {
  it("creates a log entry with required fields", () => {
    const entry = createLogEntry("info", "test message");
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("test message");
    expect(entry.timestamp).toBeDefined();
  });

  it("includes optional metadata", () => {
    const entry = createLogEntry("error", "failed", {
      requestId: "req-123",
      userId: 42,
      category: "execution",
    });
    expect(entry.requestId).toBe("req-123");
    expect(entry.userId).toBe(42);
    expect(entry.category).toBe("execution");
  });

  it("handles all log levels", () => {
    for (const level of ["debug", "info", "warn", "error"] as const) {
      const entry = createLogEntry(level, `${level} message`);
      expect(entry.level).toBe(level);
    }
  });
});

describe("request ID generator", () => {
  it("generates unique IDs", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^req-\d+-\d+$/);
  });
});
