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

