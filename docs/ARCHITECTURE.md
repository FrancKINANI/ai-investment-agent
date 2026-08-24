# Architecture

Ledgerline is a React and TypeScript operator workspace backed by Express, tRPC, Drizzle, and a MySQL-compatible database. The client is responsible for presentation and interaction; server procedures enforce data ownership and simulation boundaries.

## Workspace map

| Route | Responsibility |
| --- | --- |
| `/` | Command: watchlists, evidence research, paper proposals, and recent activity. |
| `/chat` | Dedicated supervisor research conversation and debate timeline. |
| `/wallets` | Wallet-role mandates and the explicit real-mode lock. |
| `/connections` | Venue capabilities and simulation adapter records. |
| `/settings` | Model routing, optional subagents, schedules, policy, and local owner preferences. |
| `/activity` | Immutable owner-scoped event log. |

## Agent runtime

Protected TradingAgents roles are server-defined and cannot be removed from the interface. Optional specialists have a parent role, a visible model route, read-only scopes, and a durable audit trail. The supervisor can coordinate research but cannot broaden tool scopes, create custody, or bypass policy checks.

## Data and authority flow

Public chain and market evidence flows into source-bound research. The research layer can create a proposal for **paper** review. An owner must explicitly approve a policy-passing proposal before simulated settlement. The server rejects real mandate execution; the UI mirrors that lock rather than attempting to emulate a live venue.

## Interface system

The active interface uses semantic blue/cyan tokens for normal operating states, amber for review, and red for blocked or error states. Light and dark themes share the same token vocabulary. Route-level loading skeletons are visual-only pending states and never introduce sample balances, fills, connections, or reviews.

