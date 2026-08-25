# Architecture

Ledgerline is a React and TypeScript operator workspace backed by Express, tRPC, Drizzle, and a MySQL-compatible database. The client is responsible for presentation and interaction; server procedures enforce data ownership and simulation boundaries.

## Workspace map

| Route | Responsibility |
| --- | --- |
| `/` | Command: watchlists, evidence research, paper proposals, and recent activity. |
| `/chat` | Dedicated supervisor research conversation and debate timeline. |
| `/wallets` | Wallet connection, role mandates, mode management (simulation/paper/live), and the real-mode lock. |
| `/platforms` | Platform API key management: add, test, disable, delete keys with per-platform limits and security warnings. |
| `/connections` | Venue capabilities and simulation adapter records. |
| `/alerts` | Security alerts: critical/warning/info levels, acknowledge/resolve, persistent badge. |
| `/settings` | Model routing, optional subagents, schedules, policy, and local owner preferences. |
| `/activity` | Immutable owner-scoped event log. |

## Agent runtime

Protected TradingAgents roles are server-defined and cannot be removed from the interface. Optional specialists have a parent role, a visible model route, read-only scopes, and a durable audit trail. The supervisor can coordinate research but cannot broaden tool scopes, create custody, or bypass policy checks.

## Data and authority flow

Public chain and market evidence flows into source-bound research. The research layer can create a proposal for **paper** review. An owner must explicitly approve a policy-passing proposal before simulated settlement. The server rejects real mandate execution; the UI mirrors that lock rather than attempting to emulate a live venue.

Platform API keys are stored encrypted and never shown in full after initial entry. Withdrawal permissions trigger a critical security alert. All key operations are logged to the immutable Activity record.

Security alerts are generated for critical events (permission violations, limit breaches), warnings (unusual activity, connection issues), and info events (mode changes, key operations). Alerts are structured, timestamped, and linked to the Decision Journal.

## Interface system

The active interface uses semantic blue/cyan tokens for normal operating states, amber for review, and red for blocked or error states. Light and dark themes share the same token vocabulary. Route-level loading skeletons are visual-only pending states and never introduce sample balances, fills, connections, or reviews.

The topbar displays a persistent alerts badge with unacknowledged counts. The sidebar nav includes dedicated entries for Platforms & API Keys and Security Alerts.

## Security router

The `securityRouter` tRPC router provides two sub-routers:

- **`security.alerts`**: List, count, create, and acknowledge security alerts. All operations are owner-scoped.
- **`security.platforms`**: List, add, test, disable, delete, and update limits for platform API keys. Withdrawal permissions emit critical alerts. All operations are logged to the immutable Activity record.
