# Engineering and Operations

## Development checks

Run these checks after a feature or visual change:

```bash
pnpm test
pnpm check
pnpm build
```

The test suite includes route behavior, owner preferences, theme tokens, debate semantics, policy logic, server contracts, and a dark-theme contrast audit across every active workspace.

## Frontend conventions

Use the semantic Ledgerline tokens in `client/src/index.css`: canvas, surface, ink, muted text, line, blue, cyan, review, and block. Do not reintroduce arbitrary green success colors or static inline palette edits. Use `prefers-reduced-motion` for all nonessential motion. Buttons should provide brief hover and press feedback; loading skeletons should remain distinguishable from content.

## Data-loading conventions

Only show a skeleton for an actual loading request. Use an empty state only after a successful request returns no records, and keep an error state explicit. Do not populate loading states with representative market, wallet, connection, or agent data.

## Release checklist

Verify light and dark themes, desktop and mobile layouts, keyboard focus, loading/empty/error states, and the simulation-only wording. Confirm no secret-handling or real-execution pathway was introduced. Save a checkpoint after validation; publish only through the project management interface.

## Client performance

Keep route-level workspace modules lazy-loaded so the public welcome screen and a selected workspace do not load every dashboard page upfront. Inspect production build output after substantial dependency changes; prefer narrowly scoped dynamic imports before adding manual vendor chunk rules. A larger bundle warning is a review signal, not a reason to weaken the React or tRPC module-deduplication safeguards.
