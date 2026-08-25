# Ledgerline

> **A simulation-first personal investment operations workspace for policy-bound research, multi-agent debate, and reviewable paper proposals.**

[![MIT License](https://img.shields.io/badge/license-MIT-2563EB.svg)](LICENSE) [![Simulation first](https://img.shields.io/badge/authority-simulation--only-0EA5C9.svg)](docs/architecture/security-and-data.md)

Ledgerline helps an owner turn public evidence into a durable, inspectable research workflow. It brings together a bounded agent fabric, investment-policy controls, public token evidence, a dedicated debate workspace, paper-proposal review, and immutable owner activity—without confusing research with custody or execution.

> **Safety boundary:** Ledgerline does not store wallet keys, venue credentials, seed phrases, signing authority, custody controls, live orders, or real execution capability. The real-mandate path remains server-blocked.

## Screenshots

The current product views below show the owner workspace in its **simulation-only** posture: Command for bounded research, Settings for configuration governance, and Activity for owner-scoped history.

| Command workspace | Settings and governance | Immutable activity |
| --- | --- | --- |
| ![Ledgerline Command workspace with watchlists, paper-candidate research, and simulation safeguards](/manus-storage/ledgerline-command-current_73c0a7af.png) | ![Ledgerline Settings workspace with capability registry, YAML configuration, binding governance, and hard gates](/manus-storage/ledgerline-settings-governance-current_bc79ea06.png) | ![Ledgerline Activity workspace with immutable owner-scoped events](/manus-storage/ledgerline-activity-current_d578a200.png) |

## What it provides

| Area | Capability | Boundary |
| --- | --- | --- |
| **Command** | Watchlists, public EVM evidence research, policy checks, paper proposals, and a recent activity snapshot. | Research can create a paper-review state; it cannot reach a venue. |
| **Chat** | Dedicated Supervisor conversation with Bull, Bear, and Supervisor filters, disagreement summaries, and completeness bands. | Notes are research artifacts, not trade instructions or return forecasts. |
| **Wallets** | Separate trading and investment mandate roles. | No private keys, wallet connection, signing, or custody. |
| **Connections** | Simulation adapter and venue-boundary records. | No account credentials or live venue control. |
| **Settings** | Protected model routes, optional read-only subagents, inactive discovery schedules, YAML configuration inspection, policy controls, and local owner preferences. | Changing a model or inspecting configuration never grants a new tool scope or financial authority. |
| **Activity** | Owner-scoped immutable operating history and local read-state controls. | Activity does not fabricate balances, fills, connections, or agent actions. |

## Why simulation-first

Ledgerline deliberately expands **observability and review quality before authority**. A model can assist with bounded investigation; deterministic policy rules and explicit owner approval control whether a proposal moves through a **simulated** lifecycle. This structure keeps agent reasoning, policy checks, paper settlement, and any future integration concerns separated.

## Architecture at a glance

The application uses React and TypeScript for the operator interface, tRPC and Express for typed server contracts, Drizzle with a MySQL-compatible database for owner-scoped persistence, and server-side adapters for public evidence. Protected TradingAgents roles remain server-defined. Optional specialists carry a visible parent, model route, read-only scope, and audit trail. The PAIA v0.4 foundation adds a validated, versioned Capability Registry for safe research and paper-proposal bindings; it contains no active MCP servers or execution adapters.

```text
Public evidence → bounded agent research → deterministic policy → owner approval → paper simulation → immutable activity
                                                    │
                                                    └── no live execution path
```

Read the [system overview](docs/architecture/system-overview.md), [PAIA v0.4 foundation](docs/architecture/paia-v0.4-foundation.md), [security and data boundaries](docs/architecture/security-and-data.md), and [future real-mode architecture](docs/architecture/future-real-mode-architecture.md) for the current route, capability, data, authority, and future-gate model.

## Quick start

### Prerequisites

Use **Node.js 22+** and pnpm. A local or hosted database and OAuth configuration are required for authenticated owner workflows. Do not commit environment files or populated credentials.

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
| `pnpm ledgerline config validate` | Validates the safe, inspection-only Phase 0 YAML configuration. |

### Configure the environment

Follow the [environment configuration guide](docs/maintainers/environment-configuration.md). Server secrets such as `DATABASE_URL` and `JWT_SECRET` belong only in the deployment platform’s protected configuration store. Values with a `VITE_` prefix are browser-visible by design and must never contain credentials.

## First safe workflow

1. Open **Command** and read the simulation-default authority strip.
2. Review protected agent roles, inactive schedules, and policy controls in **Settings**.
3. Start a bounded research brief in **Chat**; use the Bull and Bear filters to inspect disagreement.
4. Add a watchlist and use the Evidence Lab only with a public Ethereum contract address.
5. Review paper-proposal states and the immutable **Activity** record. Owner approval can advance a proposal only to simulated settlement.

Loading skeletons indicate a real pending request. Empty states indicate a completed request with no matching owner records. Treating those states separately is important: neither is evidence of a connection, balance, policy pass, or execution result.

## Documentation

| Audience | Document | Purpose |
| --- | --- | --- |
| New contributors | [Getting started](docs/guides/getting-started.md) | Setup, verification, and a safe first workflow. |
| Operators | [Operator guide](docs/guides/operator-guide.md) | Day-to-day use of all workspaces. |
| Developers | [System overview](docs/architecture/system-overview.md) | Routes, services, agents, and authority flow. |
| Architecture contributors | [PAIA v0.4 foundation](docs/architecture/paia-v0.4-foundation.md) | Capability registry, awareness mapping, phase gates, and execution exclusions. |
| Future-program reviewers | [Future real-mode architecture](docs/architecture/future-real-mode-architecture.md) | Prospective trust boundaries, sequential activation gates, controls, adapters, and assurance. |
| Configuration contributors | [Safe Phase 0 configuration and CLI](docs/guides/phase0-configuration-cli.md) | YAML layout, validation, supported inspection commands, and deferred authority. |
| Security reviewers | [Security and data](docs/architecture/security-and-data.md) | Storage, privacy, and execution boundaries. |
| Maintainers | [Engineering and operations](docs/maintainers/engineering-and-operations.md) | Tests, releases, tokens, and maintenance conventions. |
| Deployers | [Environment configuration](docs/maintainers/environment-configuration.md) | Required configuration names and public/private treatment. |
| Community maintainers | [Demo dataset policy](docs/maintainers/demo-dataset-policy.md) | Rules for fixtures, screenshots, seeds, and safe synthetic examples. |
| Open-source maintainers | [Open-source release guide](docs/maintainers/open-source-release.md) | Repository hygiene and release posture. |
| Product contributors | [Roadmap](docs/product/roadmap.md) | Directional development milestones. |
| Everyone | [Changelog](docs/product/changelog.md) | Public record of meaningful product, performance, and safety improvements. |

## Contributing

Contributions that improve research review, simulation fidelity, accessibility, testing, and documentation are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. The repository includes CI for tests, type checks, and production builds, plus pull request and issue templates.

Please do not commit credentials, personal data, database URLs, logs, generated builds, sample account data, venue secrets, private keys, or internal prompt materials. Do not add fabricated balances, fills, connected accounts, customer reviews, ratings, or execution results.

## Security

Report suspected vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Authentication bypasses, owner-data isolation failures, policy-bypass paths, secret exposure, and any UI behavior that implies live execution are security issues.

## License and repository status

Ledgerline is licensed under the [MIT License](LICENSE). The GitHub repository currently remains **private** by owner choice; the built-in **Star on GitHub** links are ready for use once the owner makes it public.

## Roadmap

The project prioritizes stronger evidence provenance, paper-simulation review, accessible operator ergonomics, and restricted future integrations. Any live capability would require a separate security, product, operational, and legal decision; it is not enabled by this repository.
