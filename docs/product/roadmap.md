# Roadmap

Ledgerline continues to increase **observability and review quality** before authority. The PAIA v0.4 foundation adds a validated Capability Registry: every declared research capability has a stable identifier, version, safe scope, and role binding. The roadmap is directional and does not authorize live trading.

## Completed

### Infrastructure
1. **Docker deployment:** Multi-stage Dockerfile, Docker Compose with MySQL + App, production overrides, Makefile convenience commands.
2. **CI/CD pipeline:** GitHub Actions with quality gate, security scan, Docker build, staging/production deployment.
3. **Nginx reverse proxy:** SSL termination, rate limiting, security headers, WebSocket support, custom error pages.
4. **Monitoring stack:** Prometheus metrics, Grafana dashboard, alert rules, Alertmanager, Node/MySQL/Nginx exporters.
5. **Security hardening:** Rate limiting, input sanitization, error classification, request validation, security headers.
6. **Production readiness:** Environment validation, health checks, graceful shutdown, structured logging, request ID generation.

### Core features
1. **Wallet connection:** WalletConnect and injected provider support with address display, network info, and disconnect. Mode management with simulation → paper → live progression and confirmation dialog.
2. **Platform API keys:** Full CRUD for exchange keys with encrypted storage, permission warnings, per-platform limits, test/disable/delete, and withdrawal permission alerts.
3. **Security alerts:** Dedicated alerts page with critical/warning/info levels, persistent badge, acknowledge/resolve, and structured audit logging.
4. **Binance live trading:** Real-time balances, ticker, order placement with mandate validation.
5. **KMS encryption:** AES-256-GCM with random IVs, auth tags, scrypt key derivation.
6. **WalletConnect v2:** On-chain wallet sessions with multi-chain support.
7. **Sailor mandates:** Non-custodial mandate contracts with scope-based authority and value caps.
8. **Agent execution pipeline:** Unified CEX + on-chain execution with mandate validation and audit logging.
9. **Capability governance:** Validated registry with visible role bindings, audit identifiers, and policy-safe scopes.
10. **Operator ergonomics:** Accessible loading, contrast, mobile navigation, and traceable activity review.

## In progress

1. **Evidence quality:** Richer provenance, clearer research completeness, and owner review summaries.
2. **Simulation fidelity:** Stronger paper-proposal lifecycle coverage and scenario analysis without venue access.

## Future

1. **Cloud KMS integration:** Replace the built-in AES-256-GCM with AWS KMS, GCP KMS, or HashiCorp Vault for production key management.
2. **Multi-exchange support:** Add OKX, Coinbase, Kraken API integrations beyond Binance.
3. **Advanced monitoring:** Distributed tracing, custom Grafana dashboards, SLO/SLI tracking.
4. **Automated testing:** Integration tests with real exchange sandboxes, E2E tests with Playwright.
5. **Performance optimization:** Redis caching, connection pooling, query optimization.

No capability manifest can add credentials, wallet keys, signing authority, custody, withdrawal permissions, live execution, or live venue access. Any future real capability would require a separate product decision, independent security design, explicit owner consent, and server-enforced controls. It is not on the current implementation path.
