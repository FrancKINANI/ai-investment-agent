# Changelog

This changelog records meaningful user-facing Ledgerline changes. It does not treat a planned or sealed capability as a released one.

## 2026-08 — Mission Control and scoped agent memory

Ledgerline now opens as an **agent operating theatre** rather than a settings-first dashboard. Mission Control centres the research team, ongoing and completed work, decision attention, policy/account posture, and source-aware activity. The navigation now uses Mission Control, Agent Room, Tasks, Decision Desk, Portfolio, Activity, and Configure; legacy portfolio-related paths resolve safely to Portfolio rather than leaving a dead route.

Agent Room now supports owner-scoped focused conversations with selected active research specialists. The associated memory workspace distinguishes team-shared context from private working context for the selected agent. Private memory remains private by default. Promotion to team memory requires an owner request and administrator approval or rejection, with lifecycle and audit records.

The `0011_agent_memory_workspace` schema migration is additive: it creates individual conversation, memory-entry, and memory-action tables. It was reviewed and applied only after an explicitly authorised staging target was identified. The migration created no sample records.

The update preserves the compile-time real-capital seal. The memory router has no live adapter, venue client, wallet, signing, key-decryption, or execution dependency. This release does not enable Binance orders, cancellations, credentials, wallet actions, on-chain operations, custody, or autonomous capital deployment.

## Earlier engineering improvements

Ledgerline maintains branch-to-staging governance, Node.js 24 CI, Docker-image verification, production dependency auditing, typed server contracts, test coverage, and owner-scoped audit records. These engineering controls support the research workspace; they do not change the NO-GO decision for real capital.
