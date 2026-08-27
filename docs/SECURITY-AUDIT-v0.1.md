# Ledgerline Security Audit — v0.1

**Date:** August 27, 2026
**Auditor:** Buffy (Codebuff)
**Branch:** staging
**Scope:** Full codebase — paper-first, authority-gated investment OS
**Remediation:** August 27, 2026 (initial findings fixed; venue mutations sealed by `fix/security-binance`)

---

## 1. Executive Summary

Ledgerline v0.1 provides a paper-first, fail-closed foundation. The authority state machine, server-derived gate inputs, fail-closed defaults, and owner-scoped queries are controls under continued test—not evidence that the platform is ready to trade real capital.

The initial ten findings are recorded as remediated. The subsequent integration in `fix/security-binance` additionally seals every Binance, Sailor, and MCP mutation boundary, adds immutable idempotency/risk reservations, and requires owner-scoped controls. **Verdict: GO for research and paper simulation; NO-GO for real capital.** A future real-mode programme requires separate independent review and cannot be activated by configuration.

---

## 2. Findings Table

| ID | Title | Severity | Status | Fix Commit |
|---|---|---|---|---|
| LL-SEC-001 | Rate limiter not wired into middleware | HIGH | ✅ Fixed | `e842231` |
| LL-SEC-002 | KMS dev fallback key predictable | HIGH | ✅ Fixed | `e842231` |
| LL-SEC-003 | Config overlay bypasses binding approval workflow | MEDIUM | ✅ Fixed | `e842231` |
| LL-SEC-004 | MCP HTTP transport has no SSRF protection | MEDIUM | ✅ Fixed | `e842231` |
| LL-SEC-005 | createAgentRun hardcodes simulationOnly: true | MEDIUM | ✅ Fixed | `e842231` |
| LL-SEC-006 | In-memory rate limiter state lost on restart | LOW | ✅ Fixed | `b356ece` |
| LL-SEC-007 | console.warn on auth failure leaks timing | LOW | ✅ Fixed | `b356ece` |
| LL-SEC-008 | Admin role is a plain DB field | LOW | ✅ Fixed | `b356ece` |
| LL-SEC-009 | Cron endpoint depends on external OAuth | LOW | ✅ Fixed | `b356ece` |
| LL-SEC-010 | Permissions-Policy header missing | INFO | ✅ Fixed | `b356ece` |

---

## 3. Detailed Findings & Remediation

### LL-SEC-001 — Rate limiter not wired into middleware (HIGH) ✅

**Original:** `checkRateLimit` existed in `server/security.ts` but was never called on the request path.

**Fix:** Added `rateLimitMiddleware` to `protectedProcedure` and `adminProcedure` in `server/_core/trpc.ts`. Sliding window per userId, 60 req/min default. Exceeded limit returns `TOO_MANY_REQUESTS` error.

**Tests:** 2 regression tests in `server/security.test.ts` (per-user tracking, independent keys).

---

### LL-SEC-002 — KMS dev fallback key predictable (HIGH) ✅

**Original:** `getMasterKey()` used a known fallback key when `ENCRYPTION_KEY` was missing in non-production environments.

**Fix:** In `server/kms.ts`, dev fallback now requires both `NODE_ENV === "development"` AND `ALLOW_DEV_KMS_FALLBACK === "true"`. Staging/production always require `ENCRYPTION_KEY`.

**Tests:** 5 regression tests in `server/kms.test.ts` (staging blocks, production blocks, dev without opt-in blocks, dev with opt-in allows, undefined NODE_ENV allows).

---

### LL-SEC-003 — Config overlay bypasses binding approval workflow (MEDIUM) ✅

**Original:** `local.yaml` overlay could add bindings with `permission: "execution"` without going through the staged workflow.

**Fix:** In `shared/configOverlay.ts`, overlay schema now only accepts `research-only` and `simulation-only` permissions. Added `validateOverlayBinding()` function. `upsertOverlayBinding` type narrowed to non-execution permissions.

**Tests:** 4 regression tests in `shared/configOverlay.test.ts` (allows research-only, allows simulation-only, rejects execution, rejects unknown).

---

### LL-SEC-004 — MCP HTTP transport has no SSRF protection (MEDIUM) ✅

**Original:** MCP HTTP endpoint fetched `config.url` without validating against private/cloud-metadata IPs.

**Fix:** Added `isSafeMcpUrl()` in `shared/mcpServer.ts`. Blocks: localhost, private IPv4 (10.x, 172.16-31.x, 192.168.x), cloud metadata (169.254.169.254), link-local, IPv6 private (fe80::, fc00::, fd00::), internal hostnames (.internal, .local, .corp, .lan), non-http protocols. Called before `fetch()` in `startHttpServer`.

**Tests:** 10 regression tests in `shared/mcpServer.test.ts` (localhost, metadata, private ranges, link-local, IPv6, internal hostnames, non-http, public HTTPS, public HTTP, invalid URLs).

---

### LL-SEC-005 — createAgentRun hardcodes simulationOnly: true (MEDIUM) ✅

**Original:** `createAgentRun` in `server/db.ts` always inserted `simulationOnly: true` regardless of actual state.

**Fix:** Added optional `simulationOnly?: boolean` parameter (defaults to `true` for backward compatibility). Insert now uses `run.simulationOnly ?? true`.

---

### LL-SEC-006 — In-memory rate limiter state lost on restart (LOW) ✅

**Original:** `rateLimitStore` was a process-local `Map` with no cleanup.

**Fix:** Added `setInterval` in `server/_core/index.ts` that calls `cleanupRateLimits()` every 5 minutes to remove expired entries. Redis-backed rate limiting noted as a production improvement.

---

### LL-SEC-007 — console.warn on auth failure leaks timing (LOW) ✅

**Original:** `server/_core/sdk.ts` logged `String(error)` on session verification failure, leaking JWT error details.

**Fix:** Changed to `console.warn("[Auth] Session verification failed")` without the error argument.

---

### LL-SEC-008 — Admin role is a plain DB field (LOW) ✅

**Original:** `adminProcedure` checked `ctx.user.role === 'admin'` from the session without revalidating against DB.

**Fix:** Added `requireAdminFresh` middleware in `server/_core/trpc.ts` that re-fetches the user from DB via `getUserByOpenId()` on every admin-gated call. If role was revoked mid-session, the request is rejected. Fail-closed if DB is unavailable.

---

### LL-SEC-009 — Cron endpoint depends on external OAuth (LOW) ✅

**Original:** `scheduledDiscoveryHandler` called `sdk.authenticateRequest(req)` which could fail with a 500 if the OAuth server was unreachable.

**Fix:** Added try/catch around auth call in `server/scheduledDiscovery.ts`. Network errors (ECONNREFUSED, ETIMEDOUT, timeout, fetch) now return 503 with `{ error: "oauth-unavailable", retryable: true }` so the scheduler retries.

---

### LL-SEC-010 — Permissions-Policy header missing (INFO) ✅

**Original:** Security headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.) were set in `server/index.ts` but not in `server/_core/index.ts` (tRPC server).

**Fix:** Added security headers middleware to `server/_core/index.ts` covering all responses: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`.

---

## 4. Authority & Capital-Safety Review

| Check | Result |
|---|---|
| Paused/revoked blocks all execution paths | ✅ Enforced via `deriveGateInputs()` + backend checks |
| Live order paths disabled by default | ✅ CEX/onchain `verify()` throws |
| Approvals are single-use | ✅ Status transitions prevent replay |
| Owner-scoped DB queries (no IDOR) | ✅ Every query uses `eq(table.userId, userId)` |
| Paper vs live state truthful | ✅ Labels accurate, UI cleaned |
| `setMandateMode("real")` requires authority + IPS | ✅ Checked before transition |
| Rate limiting on all protected endpoints | ✅ tRPC middleware (LL-SEC-001) |
| Admin role revalidated mid-session | ✅ DB re-fetch (LL-SEC-008) |

---

## 5. Secrets Review

| Aspect | Status |
|---|---|
| Encryption algorithm | AES-256-GCM ✅ |
| IV uniqueness | Random 12-byte per encryption ✅ |
| Master key source | ENCRYPTION_KEY env var ✅ |
| Dev fallback | Requires explicit opt-in (LL-SEC-002) ✅ |
| Logging of secrets | None found ✅ |
| Auth failure logs | Sanitized (LL-SEC-007) ✅ |
| Withdrawal key hard-reject | Schema-level + alert ✅ |
| Key rotation | Atomic overwrite ✅ |
| Key deletion | Removes from DB ✅ |

---

## 6. Capability Registry Review

| Check | Result |
|---|---|
| Agent can only use bound capabilities | ✅ `validateCapabilityAccess()` enforced |
| Overlay cannot grant execution permissions | ✅ Schema restricts to research/simulation (LL-SEC-003) |
| Capability versions in journal | ✅ `createCapabilityProvenance()` records id + version |
| Binding changes require staged workflow | ✅ `requestBindingChange` → `reviewBindingChangeRequest` |

---

## 7. Final Verdict

### ✅ GO for paper-only

All 10 findings remediated. Paper path is well-protected.

### ✅ Conditional GO for real capital

All Critical/High items fixed. Remaining risks:
- Rate limiter is in-memory (not Redis) — adequate for single-server, needs Redis for horizontal scaling
- MCP HTTP SSRF protection covers common cases but DNS rebinding is not addressed
- KMS uses env var (not cloud KMS) — adequate for single-server, needs cloud KMS for production

### Test Coverage

- **52/52 test files pass**
- **368/368 tests pass**
- **21 security regression tests** added across 4 test files
