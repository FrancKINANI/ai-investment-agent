# Pre-PostgreSQL Cleanliness Audit

## Scope

This audit covers the synchronized `main`/`staging` tree before the PostgreSQL implementation begins. It checks the repository topology, validation gates, production dependencies, migration configuration, the compiled live-capital boundary, and conservative static signals for unused code.

## Results

The `main` and `staging` trees are now synchronized after release PR #26. There are no open pull requests or unexpected remote branches. The active database contract remains MySQL/TiDB-compatible: Drizzle uses the MySQL dialect, the schema uses `mysql-core`, and the server uses `mysql2`. PostgreSQL remains a planned future implementation and is not enabled by configuration.

The complete staging validation passed: Vitest, the TypeScript check, the production build, `pnpm audit --prod`, `pnpm drizzle-kit check`, and whitespace validation. The compiled boundary continues to define `LIVE_VENUE_MUTATIONS_SEALED = true` and rejects venue mutations before any live adapter action.

## Safe cleanup

`client/src/components/DashboardLayoutSkeleton.tsx` was an unused template-derived component. Repository-wide references were checked before removal; the active application uses its own authenticated layout loading path and does not import this component. Removing it reduces dead surface without changing runtime behaviour.

## Intentional future-work markers

The remaining `TODO` comments are retained because they describe explicit, documented future capabilities rather than unreachable code: on-chain configuration validation, on-chain order submission, policy-version persistence, token-address resolution, and full MCP transport. These paths remain bounded by the existing policy and compile-time venue seal. They should be converted into separately scoped implementation issues rather than deleted or silently enabled during the PostgreSQL migration.

## Static-analysis limitation

Knip could not complete in the sandbox because its parser exhausted the available ArrayBuffer allocation, including after old development processes were stopped and a lower-memory retry was attempted. A lighter TypeScript export scan completed, but its output contains module-local exports, generated schema/type contracts, framework entry points, and intentionally public helpers; none were removed automatically. This report therefore records a conservative cleanup rather than claiming that a memory-constrained scan proved the absence of every possible unused export.

## Dependency freshness

`pnpm audit --prod` reports no known vulnerabilities. `pnpm outdated` reports newer releases for a number of dependencies, but those are freshness opportunities rather than vulnerability findings. They should be handled in a dedicated dependency-upgrade PR with its own compatibility and security validation, not mixed with the PostgreSQL dialect conversion.

## Go/no-go

The repository is clean enough to begin PostgreSQL implementation after the cleanup PR is reviewed and merged. The PostgreSQL work must use a dedicated implementation branch and a dedicated PostgreSQL staging database. It must not alter the active MySQL/TiDB database or weaken owner isolation, memory privacy, policy checks, prompt boundaries, or `LIVE_VENUE_MUTATIONS_SEALED = true`.
