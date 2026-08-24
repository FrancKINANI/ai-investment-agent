# Engineering and Operations

## Repository map

| Path | Responsibility |
| --- | --- |
| `client/src/pages/Home.tsx` | Main operator console and owner workflows. |
| `client/src/lib/` | Deterministic frontend policy/workflow helpers and tests. |
| `server/routers.ts` | tRPC contract boundary. |
| `server/db.ts` | Drizzle-backed, owner-scoped persistence helpers. |
| `server/onchain.ts` | Public Blockscout/DexScreener adapter and bounded cache. |
| `shared/agentRuntime.ts` | Provider-agnostic policy/execution-boundary logic. |
| `shared/ips.ts` | IPS validation and normalisation rules. |
| `drizzle/schema.ts` | Database schema. |
| `drizzle/*.sql` | Generated, reviewed migrations. |
| `docs/` | Repository documentation. |

## Development conventions

Use tRPC for application API traffic. Put new owner-specific data behind `protectedProcedure` and ensure database access always filters by the current `userId`. Use Zod at the API edge. Keep deterministic policy controls in shared code, not inside an LLM prompt or a browser-only conditional.

| Concern | Required convention |
| --- | --- |
| Secret or credential | Server environment only; never expose it in `VITE_*` code unless intentionally public. |
| Public external data | Server-side adapter, explicit source/freshness metadata, and an unavailable state. |
| User data | Owner-scoped query and mutation through a protected procedure. |
| Schema change | Edit schema, generate migration, review SQL, apply through managed database workflow. |
| New agent tool | Declare scope, enforce policy boundary, persist audit evidence, and keep execution unavailable by default. |

## Test strategy

The suite intentionally uses several test layers.

| Test group | What it protects |
| --- | --- |
| `shared/agentRuntime.test.ts` | Policy veto, owner pause, and execution sealing. |
| `shared/ips.test.ts` | Basis-point constraints and contract normalisation. |
| `server/onchain.test.ts` | Address validation, public-source aggregation, failure fallback, and cache behavior. |
| `server/persistence.contract.test.ts` | Protected persistence routes and owner-scoped review queries. |
| `client/src/pages/Home.test.tsx` | Private, empty, and populated research-review render states. |

Run `pnpm test && pnpm check && pnpm build` after any server, schema, policy, or UI change.

## Operational runbook

### Public data incident

If the viewer shows an unavailable error, first confirm that the input is a full Ethereum ERC-20 contract address. If the error persists, inspect the Blockscout and DexScreener upstream status. The application should not replace missing values with samples. A cache response is expected for a repeated request within 30 seconds on the same server instance.

### Authentication incident

If an authenticated owner sees a query error, inspect the browser console and server logs. A new owner with no IPS must receive `null` from `policy.current` and should see the UI’s empty-policy state. If OAuth or an anti-bot page blocks sign-in, do not bypass account controls; complete the owner session in the browser when available and then validate the workflow below.

### Required owner-flow release check

The following manual check remains the final browser-level validation after owner login is available:

1. Save an IPS with a valid approved contract.
2. Confirm the policy version and private history update.
3. Run a paper simulation and confirm the new paper run and Action-awareness record.
4. Run the scope audit and confirm the history entry.
5. Load a public token and confirm the on-chain-view audit is stored.
6. Create and review one lineage, one evaluation, and one outcome record.
7. Confirm no UI state exposes wallet, signing, exchange, or execution capability.

### Production observability

Use the platform’s production log CLI to inspect published runtime logs, and the managed database UI for records. Alerting and scheduled refreshes are intentionally not part of this MVP; introduce them only with a dedicated worker/runtime design and source-rate monitoring.

## Release checklist

| Check | Required state |
| --- | --- |
| Tests | `pnpm test` passes. |
| Types | `pnpm check` passes. |
| Build | `pnpm build` passes. |
| Migrations | Generated SQL reviewed and applied. |
| Public data | Source, freshness, cache, and unavailable states verified. |
| Authenticated owner flow | Manual browser check completed when OAuth session is available. |
| Checkpoint | Saved before publishing. |
