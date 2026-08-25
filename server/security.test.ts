import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  resetRateLimit,
  sanitizeInput,
  sanitizeObject,
  classifyError,
  validateInput,
  cleanupRateLimits,
  SECURITY_HEADERS,
} from "./security";
import { z } from "zod";

describe("rate limiter", () => {
  beforeEach(() => {
    resetRateLimit("test-key");
  });

  it("allows requests within the limit", () => {
    const result = checkRateLimit("test-key", { maxRequests: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });

  it("blocks requests exceeding the limit", () => {
    const config = { maxRequests: 3, windowMs: 60_000 };
    checkRateLimit("test-key", config);
    checkRateLimit("test-key", config);
    checkRateLimit("test-key", config);
    const result = checkRateLimit("test-key", config);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("resets after window expires", () => {
    const config = { maxRequests: 2, windowMs: 1 }; // 1ms window
    checkRateLimit("test-key", config);
    checkRateLimit("test-key", config);
    const blocked = checkRateLimit("test-key", config);
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    return new Promise(resolve => setTimeout(resolve, 10, () => {
      const allowed = checkRateLimit("test-key", config);
      expect(allowed.allowed).toBe(true);
      resolve(undefined);
    }));
  });

  it("tracks different keys independently", () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    checkRateLimit("key-a", config);
    checkRateLimit("key-b", config);
    expect(checkRateLimit("key-a", config).allowed).toBe(false);
    expect(checkRateLimit("key-b", config).allowed).toBe(false);
    // key-c is new
    expect(checkRateLimit("key-c", config).allowed).toBe(true);
  });
});

describe("input sanitizer", () => {
  it("strips dangerous characters", () => {
    expect(sanitizeInput("<script>alert('xss')</script>")).toBe("scriptalertxssscript");
    expect(sanitizeInput("'; DROP TABLE users; --")).toBe("DROP TABLE users --");
    expect(sanitizeInput('path/to/file')).toBe("pathtofile");
  });

  it("trims whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });

  it("truncates to 1000 chars", () => {
    const long = "a".repeat(2000);
    expect(sanitizeInput(long).length).toBe(1000);
  });

  it("leaves safe input unchanged", () => {
    expect(sanitizeInput("hello world 123")).toBe("hello world 123");
    expect(sanitizeInput("btc-usdt exchange.com")).toBe("btc-usdt exchange.com");
  });
});

describe("object sanitizer", () => {
  it("sanitizes nested string values", () => {
    const input = {
      name: "<script>alert(1)</script>",
      nested: { value: "test'; DROP" },
      number: 42,
    };
    const result = sanitizeObject(input);
    expect(result.name).toBe("scriptalert1script");
    expect(result.nested.value).toBe("test DROP");
    expect(result.number).toBe(42);
  });
});

describe("error classifier", () => {
  it("classifies validation errors", () => {
    const result = classifyError(new Error("validation failed: invalid input"));
    expect(result.category).toBe("validation");
    expect(result.statusCode).toBe(400);
    expect(result.shouldAudit).toBe(false);
  });

  it("classifies auth errors", () => {
    const result = classifyError(new Error("unauthorized access"));
    expect(result.category).toBe("auth");
    expect(result.statusCode).toBe(403);
    expect(result.shouldAudit).toBe(true);
  });

  it("classifies not-found errors", () => {
    const result = classifyError(new Error("resource not found"));
    expect(result.category).toBe("not_found");
    expect(result.statusCode).toBe(404);
  });

  it("classifies rate limit errors", () => {
    const result = classifyError(new Error("rate limit exceeded"));
    expect(result.category).toBe("rate_limit");
    expect(result.statusCode).toBe(429);
  });

  it("classifies external service errors", () => {
    const result = classifyError(new Error("binance API timeout"));
    expect(result.category).toBe("external");
    expect(result.statusCode).toBe(502);
  });

  it("classifies unknown errors as internal", () => {
    const result = classifyError(new Error("something weird happened"));
    expect(result.category).toBe("internal");
    expect(result.statusCode).toBe(500);
    expect(result.shouldAudit).toBe(true);
  });

  it("handles non-Error objects", () => {
    const result = classifyError("string error");
    expect(result.category).toBe("internal");
    expect(result.statusCode).toBe(500);
  });

  it("never leaks internal details in user message", () => {
    const result = classifyError(new Error("Database connection failed at host db.example.com:5432"));
    expect(result.message).not.toContain("db.example.com");
    expect(result.message).not.toContain("5432");
  });
});

describe("input validator", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
  });

  it("returns valid data on success", () => {
    const result = validateInput({ name: "Alice", age: 30 }, schema);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.name).toBe("Alice");
    }
  });

  it("returns classified error on failure", () => {
    const result = validateInput({ name: "", age: -5 }, schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.category).toBe("validation");
      expect(result.error.statusCode).toBe(400);
    }
  });
});

describe("security headers", () => {
  it("includes all required headers", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["X-XSS-Protection"]).toBe("1; mode=block");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});

describe("rate limit cleanup", () => {
  it("removes expired entries", () => {
    // Create some entries with short windows
    const config = { maxRequests: 1, windowMs: 1 };
    checkRateLimit("expired-1", config);
    checkRateLimit("expired-2", config);

    return new Promise(resolve => setTimeout(resolve, 10, () => {
      const cleaned = cleanupRateLimits();
      expect(cleaned).toBeGreaterThanOrEqual(2);
      resolve(undefined);
    }));
  });
});
