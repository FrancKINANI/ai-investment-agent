/**
 * Security Hardening Module
 *
 * Provides rate limiting, input sanitization, and error boundaries
 * for all API endpoints and tRPC routers.
 *
 * Design:
 * - Rate limiter: sliding window per userId + IP
 * - Input sanitizer: strips dangerous characters from user input
 * - Error boundary: catches and classifies errors, prevents info leakage
 * - Request validator: schema-based validation for all inputs
 */

import { z } from "zod";

// ─── Rate Limiter ─────────────────────────────────────────────────────────

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export type RateLimitConfig = {
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
};

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000, // 1 minute
};

/**
 * Check if a request is rate-limited.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > config.windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfterMs = config.windowMs - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Reset rate limit for a key (e.g., after successful auth).
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

// ─── Input Sanitizer ──────────────────────────────────────────────────────

/** Characters that could be used for injection attacks */
const DANGEROUS_CHARS = /[<>'"&;(){}[\]\\\/]/g;

/**
 * Sanitize user input by stripping potentially dangerous characters.
 * Safe for display in UI and logs.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(DANGEROUS_CHARS, "")
    .trim()
    .slice(0, 1000); // Max 1000 chars
}

/**
 * Sanitize an object's string values recursively.
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeInput(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }
  return result;
}

// ─── Error Boundary ───────────────────────────────────────────────────────

export type ClassifiedError = {
  /** User-facing message (safe to display) */
  message: string;
  /** Internal category for logging */
  category: "validation" | "auth" | "not_found" | "rate_limit" | "internal" | "external";
  /** HTTP-equivalent status code */
  statusCode: number;
  /** Whether this error should be logged for security review */
  shouldAudit: boolean;
};

/**
 * Classify an error into a safe, user-facing category.
 * Never leaks internal details (stack traces, DB errors, etc.).
 */
export function classifyError(error: unknown): ClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);

  // Validation errors
  if (msg.includes("validation") || msg.includes("invalid input") || msg.includes("required")) {
    return {
      message: "Invalid input. Please check your request and try again.",
      category: "validation",
      statusCode: 400,
      shouldAudit: false,
    };
  }

  // Auth errors
  if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("permission")) {
    return {
      message: "You don't have permission to perform this action.",
      category: "auth",
      statusCode: 403,
      shouldAudit: true,
    };
  }

  // Not found
  if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
    return {
      message: "The requested resource was not found.",
      category: "not_found",
      statusCode: 404,
      shouldAudit: false,
    };
  }

  // Rate limit
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return {
      message: "Too many requests. Please try again later.",
      category: "rate_limit",
      statusCode: 429,
      shouldAudit: false,
    };
  }

  // External service errors
  if (msg.includes("binance") || msg.includes("exchange") || msg.includes("network")) {
    return {
      message: "External service temporarily unavailable. Please try again.",
      category: "external",
      statusCode: 502,
      shouldAudit: false,
    };
  }

  // Default: internal error (never show details)
  return {
    message: "An unexpected error occurred. Please try again.",
    category: "internal",
    statusCode: 500,
    shouldAudit: true,
  };
}

// ─── Request Validator ────────────────────────────────────────────────────

/**
 * Validate input against a Zod schema and return a classified error on failure.
 */
export function validateInput<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
): { valid: true; data: T } | { valid: false; error: ClassifiedError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return {
    valid: false,
    error: {
      message: `Validation failed: ${result.error.issues.map((e: { message: string }) => e.message).join(", ")}`,
      category: "validation",
      statusCode: 400,
      shouldAudit: false,
    },
  };
}

// ─── Security Headers ─────────────────────────────────────────────────────

/**
 * Security headers for API responses.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

// ─── Cleanup ──────────────────────────────────────────────────────────────

/**
 * Periodic cleanup of expired rate limit entries.
 * Call this on a setInterval in production.
 */
export function cleanupRateLimits(): number {
  const now = Date.now();
  let cleaned = 0;
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (now - entry.windowStart > DEFAULT_RATE_LIMIT.windowMs * 2) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  return cleaned;
}
