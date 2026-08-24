# Getting Started

## Prerequisites

Use Node.js 22 or later and the version of pnpm pinned by the repository. The project uses an existing MySQL-compatible database and the Manus OAuth configuration injected by the web application environment. Do not commit `.env` files or replace the managed secrets with literal credentials.

## Install and run

Clone the repository, install dependencies, and start the development server.

```bash
git clone <your-repository-url>
cd ai-investment-agent-mvp
pnpm install
pnpm dev
```

The development server prints a local preview URL. The application provides a public, read-only Ethereum token viewer without login. Sign in only when you need to create a private owner record.

## Verify the codebase

Run all checks before making or reviewing a change.

```bash
pnpm test
pnpm check
pnpm build
```

| Command | Purpose |
| --- | --- |
| `pnpm test` | Runs server contracts, deterministic policy tests, data-adapter tests, and frontend SSR state tests. |
| `pnpm check` | Runs TypeScript without emitting output. |
| `pnpm build` | Builds the Vite client and bundles the server entrypoint. |
| `pnpm dev` | Starts the development API and Vite bridge. |

## First safe workflow

1. Open **Read-only Ethereum token viewer**.
2. Paste a public ERC-20 contract, such as the wrapped Ether contract published by Ethereum ecosystem tooling, only if you independently intend to inspect it. Ledgerline retrieves public data; it does not attest that a token is safe.
3. Inspect source labels, fetch time, freshness, and any unavailable fields.
4. Sign in when the project’s OAuth flow is available.
5. Create an IPS with basis-point limits and at least one approved contract.
6. Start a paper simulation and record a research lineage, evaluation, or outcome.

> The application has no live transaction path. Do not treat a paper record as a trading instruction.

## Database migrations

Schema changes are managed through Drizzle migration files under `drizzle/`. For a new schema change, edit `drizzle/schema.ts`, generate a migration, review its SQL, and apply the SQL through the managed database workflow.

```bash
pnpm drizzle-kit generate
```

Never apply an unreviewed migration to a production database. The project already includes migrations for the initial agent workspace, awareness/lineage data, outcome records, and the IPS/operator-action tables.

## Authentication note

The product requires a valid authenticated owner session for persisted records. The implementation has regression coverage for the “no IPS yet” state and returns `null` explicitly rather than an invalid undefined query result. The remaining manual browser validation is listed in [the runbook](ENGINEERING_AND_OPERATIONS.md).
