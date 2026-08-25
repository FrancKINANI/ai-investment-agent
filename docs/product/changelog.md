# Changelog

This public changelog records meaningful Ledgerline improvements. It focuses on operator experience, engineering quality, and safety boundaries rather than internal task history.

## Current release — Infrastructure: Docker, CI/CD, monitoring, security hardening

Ledgerline now has production-ready infrastructure with containerization, automated pipelines, and comprehensive monitoring.

### Docker deployment

- **Multi-stage Dockerfile:** deps → build → production stages for minimal image size
- **Docker Compose:** MySQL + App services with health checks and dependency ordering
- **Production overrides:** Resource limits, restart policies, and environment-specific config
- **Development Dockerfile:** Hot reload with volume mounts
- **Makefile:** Convenience commands for all operations (`make dev`, `make prod`, `make monitor`)
- **Health check endpoint:** `/healthz` returns subsystem status, uptime, and version
- **Security headers middleware:** X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy

### CI/CD pipeline

- **GitHub Actions:** Quality gate (typecheck + tests + build), security scan (Trivy), Docker build
- **Staging/production deployment:** Automated with health checks and rollback support
- **Docker image registry:** Pushed to GitHub Container Registry (ghcr.io)
- **PR validation:** All checks must pass before merge

### Nginx reverse proxy

- **SSL termination:** TLS 1.2/1.3 with HSTS preload
- **Rate limiting:** 10r/s for API, 5r/s for auth endpoints
- **Security headers:** CSP, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **WebSocket support:** For real-time updates
- **Custom error pages:** 429 (rate limit), 502 (bad gateway), 503 (maintenance)

### Monitoring stack

- **Prometheus metrics:** HTTP requests, response times, errors, agent executions, security alerts
- **Grafana dashboard:** 8 panels covering service status, request rate, error rate, latency, executions, alerts, memory, uptime
- **Alert rules:** Availability, performance, security, business metrics, infrastructure
- **Alertmanager:** Severity-based routing to Slack, email, PagerDuty
- **Exporters:** Node, MySQL, Nginx exporters for infrastructure metrics

### Security hardening

- **Rate limiting:** Sliding window per userId + IP, configurable limits
- **Input sanitization:** Strip dangerous characters, truncate to 1000 chars
- **Error classification:** Never leak internal details (DB host, stack traces) to users
- **Request validation:** Schema-based validation with Zod
- **Security headers:** nosniff, DENY frame, XSS protection, strict referrer

### Production readiness

- **Environment validation:** Fail-fast on missing DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
- **Health check:** `/healthz` with subsystem status (database, encryption, binance)
- **Graceful shutdown:** Drains connections on SIGTERM/SIGINT/uncaught exceptions
- **Structured logging:** JSON in production, readable in dev, with request correlation
- **Request ID generation:** Unique IDs for log correlation

### Testing

- **48 new tests:** Integration tests for wallet → mandate → execution pipeline, security module tests, production module tests
- **218 total passing tests:** All server, client, and shared tests pass
- **CI validation:** All checks pass in GitHub Actions

## Previous release — Live execution: Binance trading, KMS encryption, WalletConnect v2, Sailor mandates

Ledgerline now supports real execution through encrypted CEX API keys and non-custodial on-chain mandates.

**Binance live trading:** Real-time account balances, 24h ticker data, and order placement (MARKET/LIMIT, BUY/SELL) through the Platforms page. Orders are validated against active mandate limits before submission. All orders are logged to the immutable Activity record with alerts for fills and rejections.

**AES-256-GCM KMS:** API secrets are now encrypted with AES-256-GCM using random IVs and auth tags. The master key is derived from `ENCRYPTION_KEY` env var via scrypt. The base64 placeholder has been replaced. Tamper detection rejects corrupted data.

**WalletConnect v2:** On-chain wallet connection via WalletConnect v2. Supported chains: Ethereum, Polygon, Arbitrum, Optimism, Base. Session management with connect/disconnect and transaction signing flow. The agent never sees private keys.

**Sailor Protocol mandates:** Non-custodial on-chain mandate contracts. Mandates define scopes (swap, liquidity, stake, claim, transfer), per-transaction and daily value caps, and token/protocol allowlists. Owner signs mandates with their wallet. Revocation is immediate and on-chain.

**Agent execution pipeline:** Agents can now execute through two paths — CEX (Binance API) and on-chain (Sailor via WalletConnect). Both paths require active mandates, enforce value caps, and log everything to the immutable Activity record.

**Safety maintained:** No private keys stored. AES-256-GCM encryption for all secrets. WalletConnect handles signing. Sailor mandates define scope and limits. All operations audit-logged with alerts.

## Earlier releases

**Real-mode foundation:** Wallet connection, API keys dashboard, security alerts, mode management.

**Performance and public experience:** Lazy-loaded routes, stable chunks, prefetch on intent, theme support, changelog route.

**Simulation-first operating workspace:** Command, Chat, Wallets, Connections, Settings, Activity workspaces. No-custody, no-credential, no-signing boundary.

**Open-source readiness:** MIT license, contributor/security/engineering documentation, CI validation.
