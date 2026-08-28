# PostgreSQL Migration Plan

## Decision status

**Status: planned; not approved for execution.** Ledgerline currently runs against the managed MySQL/TiDB-compatible database attached to the application. This document describes the controlled path to PostgreSQL; it does not alter the active database engine, `DATABASE_URL`, Drizzle dialect, application runtime, or production data.

The migration is justified only when the project has a separately provisioned PostgreSQL staging environment, a verified source backup, a tested data reconciliation plan, and explicit approval for each environment. A Git branch named `staging` is not a database environment.

## Target state

| Area | Current state | PostgreSQL target |
| --- | --- | --- |
| Database dialect | MySQL/TiDB-compatible Drizzle schema | PostgreSQL Drizzle schema in a separate code branch |
| Driver | `mysql2` and `drizzle-orm/mysql2` | `pg` and `drizzle-orm/node-postgres` after cutover approval |
| Identifier handling | MySQL-compatible auto-increment keys | Explicit PostgreSQL identity or sequence strategy, verified table by table |
| JSON records | MySQL JSON columns | PostgreSQL `jsonb` columns where the application requires structured JSON |
| Timestamps | MySQL timestamps | UTC-preserving `timestamp with time zone` policy, verified by integration tests |
| Migration journal | `__drizzle_migrations` in the active database | A new PostgreSQL migration journal; never copied as a substitute for a schema migration |

The existing compile-time `LIVE_VENUE_MUTATIONS_SEALED = true` boundary, owner scoping, agent-memory privacy, secret screening, capability restrictions, and no-real-capital posture are invariant. Changing database engines must not alter those controls.

## Preconditions

Before any PostgreSQL implementation branch is opened, the operator must satisfy every gate below.

| Gate | Required evidence |
| --- | --- |
| Dedicated PostgreSQL staging target | An explicitly named project/database ID with non-production credentials managed outside the repository. |
| Source protection | Current MySQL/TiDB backup, restore drill, schema inventory, and row-count baseline. |
| Scope freeze | A documented source commit and ordered Drizzle migration head; no unreviewed schema changes in the migration window. |
| Data classification | A table-by-table map identifying owner-scoped data, encrypted fields, immutable records, optional empty tables, and retention requirements. |
| Test harness | Automated owner-isolation, migration, time-zone, JSON, enum, and rollback-rehearsal tests against PostgreSQL staging. |
| Approval | Explicit owner approval for staging rehearsal; a separate approval is required for production cutover. |

No wallet seed phrase, private key, provider secret, database URL, production export, or real account material belongs in fixtures, migration logs, or committed files.

## Implementation workstreams

### 1. Inventory and compatibility design

Create a dedicated `feat/postgresql-dialect` branch from the current staging head. Inventory every table, index, unique constraint, enum, timestamp, JSON field, and application query. The inventory must identify MySQL-specific assumptions, including `AUTO_INCREMENT`, `ON UPDATE CURRENT_TIMESTAMP`, boolean representations, enum alterations, identifier quoting, collation-dependent comparisons, and JSON query behaviour.

Define a PostgreSQL-native Drizzle schema in parallel rather than editing the active MySQL schema in place. The new schema must preserve logical table names and owner-scoped predicates unless a separately approved compatibility mapping requires a change. Generate and review PostgreSQL migrations against an empty PostgreSQL staging database only.

### 2. Application dual-environment readiness

Replace MySQL-specific imports and driver wiring only in the PostgreSQL branch. Keep credentials in the environment, require TLS for the PostgreSQL runtime, and make driver selection explicit through deployment configuration rather than a client-controlled setting. Do not run both databases as interchangeable production writers.

Run the full test suite against PostgreSQL staging. Add integration coverage for owner isolation, private versus shared memory retrieval, immutable activity history, alert acknowledgement, migration journal behaviour, and UTC round-trips. The sealed venue boundary must be tested before and after the driver substitution.

### 3. Rehearsed data migration

Perform a read-only export from a fixed MySQL/TiDB source snapshot. Transform data in a controlled one-way migration job outside the application request path. Validate source and target using table counts, per-owner counts, uniqueness checks, referential checks, content-digest checks for memory entries, immutable action counts, and timestamp-range comparisons.

An initial rehearsal must use non-production or sanitized data. Production data may be rehearsed only under an approved handling procedure that keeps exports encrypted, access-limited, time-bounded, and absent from the repository and sandbox filesystem once verification is complete.

### 4. Cutover and rollback

Use a maintenance window. Pause writes, take a final source backup, complete the final delta migration, verify the target, then switch the server-side `DATABASE_URL` only after release approval. Retain the MySQL/TiDB source read-only for the defined rollback window. Rollback means redirecting the application to the verified source before new writes are accepted; it must not mean partially replaying PostgreSQL changes into the old store.

## Acceptance criteria

The PostgreSQL migration is ready for an approval request only when all of the following are true:

1. PostgreSQL staging accepts the generated migrations from an empty database and records a consistent migration journal.
2. The complete automated suite passes with the PostgreSQL driver and migration checks enabled.
3. Owner-scoped reads and writes cannot cross users, including security alerts, policies, activity, conversations, and memory records.
4. Row-count and integrity reconciliation is exact or every intentional discrepancy is documented and approved.
5. The application reports the same explicit empty, loading, error, and unavailable states without fabricated records.
6. `LIVE_VENUE_MUTATIONS_SEALED` remains compile-time `true`, and no wallet, signing, key-decryption, venue-mutation, or real-capital capability is introduced.
7. A rollback drill has succeeded on staging and a production cutover runbook has been approved.

## Rollout sequence

```text
Dedicated PostgreSQL staging target
  → PostgreSQL schema branch and empty-database migration rehearsal
  → application compatibility and full test suite
  → data migration rehearsal and reconciliation
  → explicit staging approval
  → production cutover proposal with rollback drill
  → explicit production approval
```

Until all gates are met, the managed MySQL/TiDB-compatible database remains the active source of truth. This plan is a migration design, not a live-engine activation or authority change.
