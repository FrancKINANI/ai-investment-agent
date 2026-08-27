# Ledgerline Security Audit — v0.1

**Date:** August 27, 2026
**Auditor:** Buffy (Codebuff)
**Branch:** staging
**Scope:** Full codebase — paper-first, authority-gated investment OS

---

## 1. Executive Summary

Ledgerline v0.1 demonstrates **unusually strong security design** for a project at this stage. The authority state machine, server-derived gate inputs, fail-closed defaults, and owner-scoped DB queries form a solid foundation. The system correctly prevents agents from self-authorizing capital movement and keeps live execution disabled by default.

**Top 3 risks before enabling real capital:**

1. **Rate limiting exists but is not wired into tRPC middleware** — the security module's `checkRateLimit` is never called on the request path, making the API vulnerable to brute-force attacks on proposal approvals and credential operations.
2. **KMS master key falls back to a predictable dev key in non-production** — if `NODE_ENV` is accidentally not set to `production`, all encrypted API secrets are encrypted with a known key.
3. **Config overlay (`local.yaml`) can escalate capability bindings** — an owner who edits `local.yaml` can grant any role any capability, bypassing the staged binding-change request workflow.

**Verdict: GO for paper-only continued use. NO-GO for real capital until Critical/High items are fixed.**

---

## 2. Findings Table

| ID | Title | Severity | Exploitability |
|---|---|---|---|
| LL-SEC-001 | Rate limiter not wired into middleware | HIGH | High |
| LL-SEC-002 | KMS dev fallback key predictable | HIGH | Medium |
| LL-SEC-003 | Config overlay bypasses binding approval workflow | MEDIUM | Low |
| LL-SEC-004 | MCP HTTP transport has no SSRF protection | MEDIUM | Low (flagged off) |
| LL-SEC-005 | createAgentRun hardcodes simulationOnly: true | MEDIUM | N/A |
| LL-SEC-006 | In-memory rate limiter state lost on restart | LOW | Info |
| LL-SEC-007 | console.warn on auth failure leaks timing | LOW | Low |
| LL-SEC-008 | Admin role is a plain DB field | LOW | Low |
| LL-SEC-009 | Cron endpoint depends on external OAuth | LOW | Info |
| LL-SEC-010 | Permissions-Policy header missing | INFO | Info |

---

## 3. Detailed Findings

### LL-SEC-001 — Rate limiter not wired into middleware (HIGH)

**Location:** `server/security.ts` defines `checkRateLimit()` but it is never called in the tRPC middleware or Express middleware chain.

**Attack scenario:** An attacker can flood `autonomy.approveProposal`, `security.platforms.addKey`, or `authority.transition` without any throttling.

**Fix:** Add a tRPC middleware that calls `checkRateLimit(ctx.user.id)` on every protected procedure.

**Regression test:** Call a protected endpoint 65 times in 1 second, assert the 65th returns 429.

---

### LL-SEC-002 — KMS dev fallback key predictable (HIGH)

**Location:** `server/kms.ts:20-25`

If `NODE_ENV` is not `"production"`, all encrypted API secrets use a known master key. An attacker with DB read access can decrypt all stored Binance secrets.

**Fix:** Block KMS fallback when `NODE_ENV` is `staging` or unset. Add a health check.

**Regression test:** Assert `getMasterKey()` throws when `NODE_ENV=staging` and `ENCRYPTION_KEY` is unset.

---

### LL-SEC-003 — Config overlay bypasses binding approval workflow (MEDIUM)

**Location:** `shared/configOverlay.ts`

The `local.yaml` overlay can add bindings with `permission: "execution"` without going through the staged `requestBindingChange → reviewBindingChangeRequest` flow.

**Fix:** Disallow `permission: "execution"` in overlay bindings, or require a signature flag.

**Regression test:** Assert that `mergeOverlay()` with `permission: "execution"` in the overlay rejects or warns.

---

### LL-SEC-004 — MCP HTTP transport has no SSRF protection (MEDIUM)

**Location:** `shared/mcpServer.ts:207`

The MCP HTTP endpoint fetches `config.url` without validating against private/cloud-metadata IPs.

**Fix:** Add URL validation: reject private IPs, localhost, link-local, cloud metadata ranges.

---

### LL-SEC-005 — createAgentRun hardcodes simulationOnly: true (MEDIUM)

**Location:** `server/db.ts:64`

Every agent run is recorded as simulation-only regardless of the actual authority state.

**Fix:** Accept `simulationOnly` as a parameter or derive it from the authority state at creation time.

---

### LL-SEC-006 through LL-SEC-010 (LOW/INFO)

See full details in the detailed audit. These are hardening gaps, not active vulnerabilities.

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

**One gap:** `createAgentRun` hardcodes `simulationOnly: true` in audit trail (LL-SEC-005).

---

## 5. Secrets Review

| Aspect | Status |
|---|---|
| Encryption algorithm | AES-256-GCM ✅ |
| IV uniqueness | Random 12-byte per encryption ✅ |
| Master key source | ENCRYPTION_KEY env var ✅ |
| Dev fallback | Predictable (LL-SEC-002) ❌ |
| Logging of secrets | None found ✅ |
| Withdrawal key hard-reject | Schema-level + alert ✅ |
| Key rotation | Atomic overwrite ✅ |
| Key deletion | Removes from DB ✅ |
| Auto-rotation reminders | Not implemented (backlog) |

---

## 6. Test Gap Analysis

Most important missing tests:

1. **Rate limit enforcement on tRPC** (Critical)
2. **KMS fallback blocked in staging** (High)
3. **Overlay binding escalation rejected** (High)
4. **Authority blocks proposal approval** (High)
5. **Double-approval rejection** (Medium)
6. **Cross-owner data access blocked** (Medium)
7. **MCP SSRF URL rejection** (Medium)

---

## 7. Go / No-Go

### ✅ GO for paper-only

Paper path is well-protected. All execution-adjacent paths gated. Owner-scoped. Capability-enforced.

### ❌ NO-GO for real capital until

1. LL-SEC-001: Wire rate limiter
2. LL-SEC-002: Block KMS fallback in staging
3. LL-SEC-005: Parameterize simulationOnly
4. LL-SEC-003: Restrict overlay permissions

All are small, focused fixes completable in a single session.
