# Architecture

Ledgerline is a React and TypeScript operator workspace backed by Express, tRPC, Drizzle, and a MySQL-compatible database. The client is responsible for presentation and interaction; server procedures enforce data ownership and simulation boundaries.

## Workspace map

| Route | Responsibility |
| --- | --- |
| `/` | Command: watchlists, evidence research, paper proposals, and recent activity. |
| `/chat` | Dedicated supervisor research conversation and debate timeline. |
| `/wallets` | Wallet connection (WalletConnect v2), Sailor mandates, role mandates, mode management. |
| `/platforms` | Platform API key management + live Binance trading (balances, orders, ticker). |
| `/connections` | Venue capabilities and simulation adapter records. |
| `/alerts` | Security alerts: critical/warning/info levels, acknowledge/resolve, persistent badge. |
| `/mandates` | Sailor Protocol mandate management: create, activate, revoke with scope and value caps. |
| `/settings` | Model routing, optional subagents, schedules, policy, and local owner preferences. |
| `/activity` | Immutable owner-scoped event log. |

## Server routers

| Router | Purpose |
| --- | --- |
| `agentFabric` | Agent nodes, conversations, evolution, model routes, capability registry |
| `autonomy` | Mandates, connections, proposals, hard gates, simulation settlement |
| `policy` | Investment Policy Statement CRUD |
| `research` | Token research with policy checks |
| `history` | Immutable activity log |
| `audit` | Strategy lineages, evaluations, outcomes, awareness records |
| `onchain` | Public Ethereum token metrics |
| `security` | Alerts (CRUD) + Platform API keys (CRUD + limits) |
| `live` | Binance API: balances, ticker, orders (place/cancel), exchange info |
| `wallet` | WalletConnect v2 sessions + Sailor Protocol mandates |

## Server modules

| Module | Purpose |
| --- | --- |
| `kms.ts` | AES-256-GCM encryption for API secrets |
| `binance.ts` | Binance REST API client with HMAC-SHA256 signing |
| `liveAdapter.ts` | Live execution with mandate validation and safety guards |
| `walletService.ts` | WalletConnect v2 session management |
| `sailorService.ts` | Sailor Protocol mandate CRUD and execution |
| `agentExecutor.ts` | Unified CEX + on-chain execution pipeline |
| `security.ts` | Rate limiting, input sanitization, error classification |
| `production.ts` | Environment validation, health checks, graceful shutdown |
| `metrics.ts` | Prometheus metrics endpoint and tracking |

## Agent runtime

Protected TradingAgents roles are server-defined and cannot be removed from the interface. Optional specialists have a parent role, a visible model route, read-only scopes, and a durable audit trail.

Agents can now execute through two paths:

### CEX execution (Binance)
```
Agent proposal → live adapter → mandate check → Binance API → order result → audit log
```

### On-chain execution (Sailor)
```
Agent proposal → live adapter → mandate check → WalletConnect → owner signs → broadcast → audit log
```

Both paths enforce active mandate, value caps, and immutable audit logging.

## Data and authority flow

```
Public evidence → bounded agent research → deterministic policy → owner approval
    │                                                        │
    ├── Paper simulation (safe path)                         │
    │   └── simulated settlement → activity log              │
    │                                                        │
    ├── CEX execution (requires active mandate)              │
    │   └── Binance API → order → activity log + alert       │
    │                                                        │
    └── On-chain execution (requires Sailor mandate)         │
        └── WalletConnect → owner signs → broadcast → log    │
```

Platform API keys are stored encrypted with AES-256-GCM (KMS module). Withdrawal permissions trigger a critical alert. All key operations are logged to the immutable Activity record.

WalletConnect v2 handles on-chain signing — the agent never sees private keys. Sailor Protocol mandates define scope, value caps, and allowed tokens/protocols. Mandate revocation is immediate and on-chain.

## KMS — Key Management Service

Secrets are encrypted with AES-256-GCM using random IVs and auth tags. The master key is derived from `ENCRYPTION_KEY` env var via scrypt. Dev fallback uses a fixed passphrase with a console warning.

## Security hardening

- **Rate limiting:** Sliding window per userId + IP, configurable limits (10r/s API, 5r/s auth)
- **Input sanitization:** Strip dangerous characters, truncate to 1000 chars
- **Error classification:** Never leak internal details to users
- **Request validation:** Schema-based validation with Zod
- **Security headers:** nosniff, DENY frame, XSS protection, strict referrer

## Production infrastructure

### Docker

Multi-stage Dockerfile (deps → build → production) with Docker Compose for MySQL + App. Production overrides add resource limits and restart policies. Makefile provides convenience commands.

### CI/CD

GitHub Actions pipeline with quality gate (typecheck + tests + build), security scan (Trivy), Docker build, and staging/production deployment. All checks must pass before merge.

### Nginx

Reverse proxy with SSL termination (TLS 1.2/1.3), rate limiting, security headers, WebSocket support, and custom error pages.

### Monitoring

Prometheus scrapes `/metrics` endpoint for HTTP requests, response times, errors, agent executions, and security alerts. Grafana dashboard displays 8 panels. Alert rules cover availability, performance, security, and business metrics. Alertmanager routes alerts to Slack, email, or PagerDuty.

## Interface system

The active interface uses semantic blue/cyan tokens for normal operating states, amber for review, and red for blocked or error states. Light and dark themes share the same token vocabulary. The topbar displays a persistent alerts badge. The Platforms page shows live Binance balances and an order form for active keys.
