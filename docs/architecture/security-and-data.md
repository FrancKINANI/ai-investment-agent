# Security and Data Boundaries

Ledgerline’s core product rule is simple: **authority expands more slowly than observability**.

## Prohibited capabilities

The application must not accept, retain, reveal, or derive wallet seed phrases, private keys, venue API secrets, withdrawal credentials, signing authority, custody control, or live order routing. The real-mandate path remains server-blocked even if an interface control is visible.

## Permitted capabilities

Ledgerline may read public evidence, persist owner-scoped policy and research records, create simulation-only proposal states, record immutable activity, and render capability boundaries. Schedules remain inactive until a separate owner action on a deployed environment.

## Data discipline

Owner-scoped records use the authenticated identity supplied by the server context. Browser-local preferences contain display, density, and shortcut choices only. The read marker for Activity is browser-local and must never modify source event data. Files belong in managed object storage, with metadata rather than raw bytes stored in the database.

## UI truthfulness

Never fabricate balances, venue connections, fills, ratings, testimonials, agent actions, or market evidence. Loading skeletons must communicate pending data, while empty and error states must remain explicit. Visual styling cannot imply real execution or successful authentication.

## Reviewed hardening controls

The maintained [security review record](../maintainers/security-review-2026-08.md) describes the current application-level hardening work. Public token-data requests are constrained to fixed providers, validated addresses, bounded cache entries, request timeouts, and shape-checked provider responses. Scheduled callbacks use a stable non-sensitive error envelope rather than returning raw exception details or request URLs.

Dependency controls are maintained at the workspace level and production dependency auditing is part of the verification cycle. A clean audit does not replace an independent penetration test, production threat model, operational monitoring, or a separate review before any future authority expansion.

## Owner security signals

The Activity workspace projects **only actual immutable owner-scoped records** into security signals. A blocked authority request, failed capability-bound validation, or a hard-gate review can therefore be surfaced with its timestamp and journal detail. For example, a request to activate real mode is recorded as blocked before the server returns a forbidden response.

> Security signals are not wallet monitoring. They do not inspect wallet addresses, API keys, browser extensions, exchange accounts, platform authorizations, transaction broadcasts, balances, or real transaction failures. Those integrations do not exist in the current product.

This design gives an owner a truthful alert surface for the controls Ledgerline actually enforces, without implying that the application has live security telemetry or financial authority.
