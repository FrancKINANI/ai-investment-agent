# Ledgerline — Roadmap & Remaining Work

**Date:** 2026-08-25 · **State:** Stages 0–5 of the real-mode program implemented (PR #7 open), Phase 0 architecture audit delivered (PR #6 open). System default authority remains `disabled`; nothing live is enabled.

This document is the single source of truth for what remains. It is ordered by decision priority, not by category.

---

## 1. Pending owner decisions (blocking merges)

| # | Item | Where | What is needed |
|---|---|---|---|
| D1 | **Stage 5 review & merge** | PR `feat/stage5-limited-live` (#7) | Owner reviews the 5 commits (incl. review-hardening commit). On merge: run `pnpm db:push` at next deploy — migration `drizzle/0009_*.sql` consolidates all Stage 0–5 schema changes. |
| D2 | **Architecture audit validation** | PR #6 (`docs/architecture-audit.md`) | Owner reads the audit, confirms or amends findings. Unblocks the refactor program (§4) and decides the fate of S1–S3 (§3). |

## 2. Security findings awaiting triage (from the Phase 0 audit)

These are **not** refactors — they are functional security gaps flagged per engagement rules. Recommended before any real `limited-live` usage.

- **S1 (High)** — `ownerPauseActive` is hardcoded `false` in `server/research.ts` research pipeline instead of reading `getAuthorityState`. A paused/revoked owner would still see proposals advance through research.
  *Fix:* wire to authority state + negative test (paused ⇒ no advancement).
- **S2 (High)** — Promotion gate inputs (`simulationPassed`, `lineageCoverage`, `complexityPenalty`) come from client input in `routers.ts` promotion/approval procedures. A manipulated client can assert success.
  *Fix:* derive from persisted simulation records server-side; reject client assertions.
- **S3 (Medium)** — No regression test proving Decision Kernel inputs derive from raw stored data rather than caller claims.
  *Fix:* kernel-boundary test per rule 9 of the refactor prompt.

## 3. Real-mode program — what remains after Stage 5

Stages 0–4 are merged to main. Stage 5 is in review. The ladder after Stage 5:

| Stage | Scope | Status |
|---|---|---|
| 0–4 | Authority machine, paper execution, read-only data, credentials, wallet view-first | ✅ merged |
| 5 | Limited live execution (one venue, one action class) | 🔶 PR #7 open |
| **5.1** | **Live approval UI**: tRPC surface exists (`authority.approveLiveOrder`, `pendingApprovals`); an owner screen is missing (see blocked orders → approve/reject with hash) | not started |
| **5.2** | **Automatic balance reconciliation**: periodic job comparing venue balances vs executionLedger projection; alert on drift (today reconciliation is manual via `reconcilePaperOrder`, live side is ledger-only) | not started |
| **5.3** | **Legacy `armed` semantics decision**: currently treated as live intent alongside `real`. Either keep (documented) or deprecate the enum toward pure authority-state control | owner decision |
| **6** | **Autonomy expansion**: move `approval-required-live` → `limited-live` requires accumulated evidence (reconciliation matches, no blocked anomalies) + explicit owner transition. Kill switch (`paused`/`revoked`) must be re-tested under load first | gated on evidence |

## 4. Architectural refactor (Phase 1–5) — PAUSED by owner decision

Blocked behind D2 (audit validation). Order and scope are defined in the refactor prompt + `docs/architecture-audit.md`:

1. **Phase 1 — Orchestrator extraction** from `routers.ts` (the Bull→Bear→FundManager→Supervisor sequence is inline at `routers.ts:217`)
2. **Phase 2 — MemoryProvider** over `agentFabricDb` message functions
3. **Phase 3 — ToolRegistry with role scoping** (preventive — agents have no tools today)
4. **Phase 4 — Event-sourced proposals/mandates** (append-only ledger events; projections by fold; migration script with explicit `MigratedFromLegacyState` boundary)
5. **Phase 5 — VenueAdapter** (static Map: binanceCexAdapter + evmChainAdapter wrapping `agentExecutor.ts` branches)

Anti-over-engineering guardrails apply as specified (no LangGraph, no dynamic plugins, no out-of-scope migrations).

## 5. Infrastructure & hardening backlog

| Item | Detail | Priority |
|---|---|---|
| Cloud KMS | Replace env-var master key (`ENCRYPTION_KEY`) with AWS/GCP KMS or Vault. AES-256-GCM envelope stays; key custody moves out of env vars | Medium (before significant capital) |
| WalletConnect v2 | Stage 4 covers injected provider only. Real WC needs `@walletconnect/sign-client` + projectId; sessions already persist correctly | Medium |
| Non-binance credential verification | `testConnection` honestly refuses for okx/coinbase/kraken/polymarket; implement when venues are enabled | Low (blocked by one-venue policy) |
| Deploy pipeline migration step | Ensure `db:push`/`drizzle-kit migrate` runs on deploy; verify `0009` applies cleanly against production | High (at next deploy) |
| Monitoring hooks | Prometheus metrics exist (`server/metrics.ts`); wire alerts for: authority transitions, approval consumption failures, ledger/venue mismatches, rate-limit exhaustion | Medium |
| Backup/restore drill | Append-only tables (`executionLedger`, `operatorActions`, `liveOrderApprovals`) must be included in backups; test restore + replay | Medium |

## 6. Explicitly out of scope (do not do)

- No withdrawal authority, ever, in current mandate
- No second venue until Binance evidence justifies it (one-venue policy)
- No autonomy above `limited-live` without owner-approved evidence review
- No browser-side secrets or signing material
- No renaming/refactors outside the agreed phases

---

*Update this document whenever a decision above is taken; each section should reflect reality, not intent.*
