# Ledgerline

> **A real, owner-controlled multi-agent investment OS with configuration-driven execution backends, capability bindings, and hard policy gates.**

[![MIT License](https://img.shields.io/badge/license-MIT-2563EB.svg)](LICENSE) [![Phase](https://img.shields.io/badge/phase-1--staging-10B981.svg)](docs/roadmap.md)

Ledgerline is a **production infrastructure** for personal investing. You own and control it completely — which agents run, what models they use, which tools they access, how capital executes, and what policies protect you. One unified pipeline with swappable backends (paper, CEX, on-chain). Fail-closed defaults that climb the authority state machine under your control.

> **Safety foundation:** Full configuration ownership via YAML. Agent team config-driven. Research model configurable. Capability bindings enforced at runtime. Owner pause wired into every sensitive entry point. Execution backends pluggable and authority-gated. No hard-coded roles, models, or execution paths.

## Current State

**Phase 0–1** focuses on the **operating system layer** — config-driven agents, enforced capability bindings, and a real execution pipeline with pluggable backends.

| Feature | Status | Control |
| --- | --- | --- |
| **Agent team** | ✅ Config-driven | `config/agents/team.yaml` |
| **Research model** | ✅ Configurable | `team.yaml` per-agent model |
| **Owner authority** | ✅ Enforced | Authority state machine (disabled → real-armed) |
| **Capability bindings** | ✅ Runtime-gated | `config/bindings/protected-roles.yaml` + enforcement |
| **Execution backends** | ✅ Pluggable | `config/execution/backend.yaml` (paper/cex/onchain) |
| **CEX execution** | 📋 Phase 2 | API keys + mandate + authority state |
| **On-chain execution** | 📋 Phase 3 | Sailor/WalletConnect + owner signature |

## Architecture: One Pipeline, Pluggable Backends

```
                          Research
                            ↓
                   Agent Fabric (configurable)
                            ↓
                  Policy + Hard Gates (IPS + Risk)
                            ↓
                      Owner Approval
                            ↓
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
    Paper Backend       CEX Backend      On-chain Backend
   (testing/audit)  (Binance, OKX, etc)   (Sailor, Wallet)
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    Execution Result
                            ↓
            Decision Journal + Audit Trail
```

**Key insight**: Paper, CEX, and on-chain all use the same decision pipeline. The only difference is the backend. Swap `config/execution/backend.yaml` to switch execution modes. No code changes.

## Configuration-Driven Control

Everything important is controlled via YAML:

```yaml
# config/agents/team.yaml — Which agents run, their models, capabilities
agents:
  - id: macro
    model: gpt-4-turbo
    enabled: true
    capabilities: [market-evidence.read]
  - id: risk
    model: claude-opus
    enabled: true
    canVeto: true
    capabilities: [portfolio.read]

# config/bindings/protected-roles.yaml — Who can use what
bindings:
  - capabilityId: market-evidence.read
    roleKeys: [macro, onchain, variation]
    permission: research-only

# config/execution/backend.yaml — How orders execute
active: paper  # paper, cex, or onchain
backends:
  paper: { enabled: true, riskLevel: "none" }
  cex: { enabled: false, riskLevel: "high" }

# config/default.yaml — System boundaries
executionBoundary: fail-closed
profile: owner-os
```

Change a YAML file, restart — no code modifications required. Operators can:
- Enable/disable agents
- Swap models
- Bind capabilities to agents
- Switch execution backends
- Adjust policy and risk limits

## CLI Tools for Inspection

```bash
# Inspect agent team
ledgerline agents list
ledgerline agents list --layer research --enabled-only

# See available capabilities
ledgerline capabilities list
ledgerline capabilities list --agent macro

# View current bindings
ledgerline bindings show
ledgerline bindings show macro
```

## Fail-Closed Defaults

- **Owner authority starts: `disabled`**. Research runs. Paper backend available. Real execution: blocked.
- **Climb to `approval-required-live`**: Owner explicitly enables real orders via authority state machine.
- **Add active mandate**: Set venue + balance cap + rebalance limits.
- **Hard gates**: IPS check + risk veto + evaluator sign-off.
- **Every order journaled**: Decision → approval → execution → result → audit trail.

## Deployment

Ledgerline runs on Express + React + TypeScript + Drizzle + MySQL (or PostgreSQL). Docker Compose included for dev + prod.

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Read [architecture docs](docs/architecture/), [roadmap](docs/roadmap.md), and [security model](docs/architecture/security-and-data.md) for full details.

## What's Next

**Slice 3** ✅: Execution backend abstraction + orchestrator extraction
**Slice 4** (planned): MCP integration (optional, disabled by default)
**Phase 2** (planned): CEX execution (real orders on Binance/OKX, with hard gates)
**Phase 3** (planned): On-chain execution (non-custodial via Sailor/WalletConnect)

---

> Ledgerline: Your investment OS. You own it. You configure it. You approve every trade. Policy protects you. Authority state machine governs the ascent to real execution. 🎯

## Docker deployment

Ledgerline includes Docker configuration for both development and production environments.

### Development with Docker

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your settings
nano .env

# Start development environment (MySQL + App)
docker-compose up

# Or in background
docker-compose up -d
```

### Production with Docker

```bash
# Set production environment variables
export JWT_SECRET=your-super-secret-key
export ENCRYPTION_KEY=$(openssl rand -hex 32)

# Start production environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Docker commands

```bash
# Show all available commands
make help

# Common commands
make dev          # Start development environment
make prod         # Start production environment
make stop         # Stop all containers
make logs         # Show logs
make db-push      # Push database schema
make test         # Run tests in container
make typecheck    # Run TypeScript checks
```

### Health check

The server exposes a health check endpoint at `/healthz`:

```bash
curl http://localhost:3000/healthz
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production",
  "version": "1.0.0"
}
```

## Quick start

### Prerequisites

Use **Node.js 24.x LTS** and pnpm. The project declares Node.js 24 as its supported runtime, which is also used by the CI workflows and Docker images. A local or hosted database and OAuth configuration are required for authenticated owner workflows. Do not commit environment files or populated credentials.

```bash
git clone https://github.com/FrancKINANI/ai-investment-agent-mvp.git
cd ai-investment-agent-mvp
pnpm install
pnpm dev
```

The development server prints a local URL. Open `/welcome` for the public project introduction or `/` for the Command workspace.

### Verify the project

```bash
pnpm test
pnpm check
pnpm build
```

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Starts the development server. |
| `pnpm test` | Runs server, policy, theme, accessibility-oriented loading, and UI regression tests. |
| `pnpm check` | Runs TypeScript without emitting output. |
| `pnpm build` | Produces the production client and server bundles. |
| `pnpm ledgerline config validate` | Validates the YAML configuration. |

### Configure the environment

Follow the [environment configuration guide](docs/maintainers/environment-configuration.md). Server secrets such as `DATABASE_URL` and `JWT_SECRET` belong only in the deployment platform's protected configuration store. Values with a `VITE_` prefix are browser-visible by design and must never contain credentials.

## First workflow

1. Open **Command** and read the authority strip.
2. Review protected agent roles, inactive schedules, and policy controls in **Settings**.
3. Start a research brief in **Chat**; use the Bull and Bear filters to inspect disagreement.
4. Add a watchlist and use the Evidence Lab only with a public Ethereum contract address.
5. Review proposal states and the immutable **Activity** record.
6. Visit **Wallets** to connect a wallet and explore mode management.
7. Visit **Platforms & API Keys** to add an exchange API key with trading-only permissions.
8. Check **Security Alerts** for any alerts generated by your actions.

Loading skeletons indicate a real pending request. Empty states indicate a completed request with no matching owner records. Treating those states separately is important: neither is evidence of a connection, balance, policy pass, or execution result.

## Documentation

| Audience | Document | Purpose |
| --- | --- | --- |
| New contributors | [Getting started](docs/guides/getting-started.md) | Setup, verification, and a first workflow. |
| Operators | [Operator guide](docs/guides/operator-guide.md) | Day-to-day use of all workspaces. |
| Developers | [System overview](docs/architecture/system-overview.md) | Routes, services, agents, and authority flow. |
| Architecture contributors | [PAIA v0.4 foundation](docs/architecture/paia-v0.4-foundation.md) | Capability registry, awareness mapping, phase gates, and execution exclusions. |
| Future-program reviewers | [Future real-mode architecture](docs/architecture/future-real-mode-architecture.md) | Trust boundaries, sequential activation gates, controls, adapters, and assurance. |
| Configuration contributors | [Safe Phase 0 configuration and CLI](docs/guides/phase0-configuration-cli.md) | YAML layout, validation, supported inspection commands. |
| Security reviewers | [Security and data](docs/architecture/security-and-data.md) | Storage, privacy, and execution boundaries. |
| Maintainers | [Engineering and operations](docs/maintainers/engineering-and-operations.md) | Tests, releases, tokens, and maintenance conventions. |
| Deployers | [Environment configuration](docs/maintainers/environment-configuration.md) | Required configuration names and public/private treatment. |
| Community maintainers | [Demo dataset policy](docs/maintainers/demo-dataset-policy.md) | Rules for fixtures, screenshots, seeds, and safe synthetic examples. |
| Open-source maintainers | [Open-source release guide](docs/maintainers/open-source-release.md) | Repository hygiene and release posture. |
| Product contributors | [Roadmap](docs/product/roadmap.md) | Directional development milestones. |
| Everyone | [Changelog](docs/product/changelog.md) | Public record of meaningful product, performance, and safety improvements. |

## Contributing

Contributions that improve research review, evidence quality, accessibility, testing, and documentation are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. The repository includes CI for tests, type checks, and production builds, plus pull request and issue templates.

Please do not commit credentials, personal data, database URLs, logs, generated builds, sample account data, venue secrets, private keys, or internal prompt materials. Do not add fabricated balances, fills, connected accounts, customer reviews, ratings, or execution results.

## Security

Report suspected vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Authentication bypasses, owner-data isolation failures, policy-bypass paths, secret exposure, and any UI behavior that misrepresents execution state are security issues.

## License and repository status

Ledgerline is licensed under the [MIT License](LICENSE). The GitHub repository currently remains **private** by owner choice; the built-in **Star on GitHub** links are ready for use once the owner makes it public.

## Roadmap

The project prioritizes stronger evidence provenance, accessible operator ergonomics, and restricted execution integrations. Any live capability requires a separate security, product, operational, and legal decision — governed by the authority state machine.
