# Security Remediation — August 2026

## Scope and release posture

This branch remediates the confirmed security findings from the staging review. It does **not** authorize real capital, wallet signing, custody, transaction broadcast, exchange order placement, cancellation, or MCP activation. The only permitted production posture is research, read-only public data, explicit owner notes, and paper simulation.

> **Release decision:** This change set is suitable for integration testing in `staging`. It remains **not approved for real-capital operation**. Any future activation must begin in a separate, independently reviewed programme rather than by changing configuration.

| Finding area | Remediation in this branch | Verification |
|---|---|---|
| Binance cancellation and direct service paths | Every mutation has authority/mandate controls and a compile-time sealed service boundary before key decryption or venue I/O. | `liveAdapter.stage5.test.ts` |
| Cross-owner Sailor access | Mandate activation, revocation, transaction reads, and execution resolve the mandate through its owner first. | `sailorService.test.ts` |
| Key status and limits | New keys default to `testing`; the live adapter requires positive, verified per-order, allocation, and daily limits. | Schema and live risk validation tests |
| Concurrent live-order retries | An idempotency intent and daily risk bucket use database uniqueness and conditional updates before external I/O. | Schema migration and adapter path review |
| Client-forged operational facts | Browser calls may create only a clearly labelled, non-authoritative owner note; server paths create control events. | `securityRouter.test.ts` |
| Capability and MCP escalation | Execution bindings have no runtime permission in a fail-closed registry; local overlays cannot activate MCP or execution; the MCP manager is sealed. | Capability and MCP boundary tests |
| Sensitive mutation abuse | Authority, key, mandate, and venue mutations use same-origin validation when an Origin header exists plus per-user/path rate limits. | `sensitiveProcedure.test.ts` |

## Required database migration

Apply the canonical generated migration `drizzle/0010_lethal_mikhail_rasputin.sql` through the normal staging migration process before any code path relies on persistent live-order intentions or daily-risk reservations. The migration is **not applied by this branch** and must not be run against production without a backup, review, and migration approval. Run `pnpm drizzle-kit check` from the checked-out commit immediately before staging execution to verify the journal and snapshots still match the SQL.

## Future activation gates

Removing `LIVE_VENUE_MUTATIONS_SEALED` is prohibited as a configuration-only or emergency shortcut. A future real-mode programme must replace this boundary only after independent review of hardware-backed secret isolation, signed approval design, database migration verification, venue sandbox reconciliation, rate limiting across instances, incident response, and staged exposure limits.
