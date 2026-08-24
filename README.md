# Ledgerline

> **A visual, multi-agent personal investment operating system with policy-governed simulation mandates.**

Ledgerline is private personal infrastructure for supervising specialised investment agents across research, risk, portfolio, and venue workflows. It provides a command center, wallet-role mandates, simulated venue adapters, policy-governed paper proposals, and an immutable activity log. **The current product is simulation-only: it does not connect a wallet, hold a private key, sign, place an order, or execute a transaction.**

## Current status

| Capability | Status | Notes |
| --- | --- | --- |
| Conversation-first token research agent | Available | Authenticated owner submits an Ethereum contract and a diligence question; model response is constrained to supplied public evidence and strict structured output. |
| Read-only Ethereum token viewer | Available | Public Blockscout and DexScreener data, sourced server-side with bounded caching. |
| IPS editor | Available | Stores concentration, reserve, transaction, daily mandate, and approved-contract limits per owner. |
| Paper simulations | Available | Creates a durable, policy-bound simulation run; no execution adapter exists. |
| Research lifecycle | Available | Persists and reviews lineage, evaluation, outcome, and awareness records. |
| AI provider registry | Available | Provider-aware model catalog and role/policy abstractions. |
| Multi-agent command center | Available | Visual supervisor, discovery, on-chain, risk, portfolio, venue, and audit roles with real project-state indicators. |
| Wallet mandates | Available in simulation | Owner-scoped trading and investment role mandates with persistent simulation/paused state. |
| Venue adapters | Available in simulation | Persisted simulation adapters for Binance, EVM protocols, and Polymarket; no credential or account connection. |
| Proposal lifecycle | Available in simulation | Research creates a durable proposal; owner may approve, reject, or settle it only in the simulator. |
| Live execution, custody, wallet signing | **Unavailable by design** | Real mode is deterministically blocked until a verified venue adapter, mandate, and execution-readiness gates exist. |
| Browser owner-flow verification | Deferred | The implementation and contract tests are complete; a Cloudflare-gated owner session still needs a manual final pass. |

## Documentation map

| Document | Purpose |
| --- | --- |
| [Getting started](docs/GETTING_STARTED.md) | Local setup, first run, and the first safe workflows. |
| [Phase 1 product brief](docs/PHASE1_PRODUCT_BRIEF.md) | The target user, research-agent job, owner journey, authority model, and measurable Phase 1 gates. |
| [Autonomy and execution contract](docs/AUTONOMY_AND_EXECUTION_CONTRACT.md) | Dual-mode mandates, wallet roles, venue adapters, safeguards, and the gates required before any live connection. |
| [Autonomous OS information architecture](docs/AUTONOMY_OPERATING_SYSTEM_IA.md) | Command, wallets, connections, settings, activity-log design, and event model. |
| [Autonomy validation](docs/AUTONOMY_VALIDATION.md) | Automated, desktop, mobile, and deferred owner-session validation evidence. |
| [Product and operating model](docs/PRODUCT_AND_OPERATING_MODEL.md) | Product scope, operating principles, user journeys, and MVP boundaries. |
| [Architecture](docs/ARCHITECTURE.md) | System structure, data model, APIs, agent topology, and execution boundary. |
| [Security and data](docs/SECURITY_AND_DATA.md) | Security invariants, scope model, data provenance, caching, and reliability behavior. |
| [Operator guide](docs/OPERATOR_GUIDE.md) | How to use the IPS, public viewer, paper simulations, and research records. |
| [Engineering and operations](docs/ENGINEERING_AND_OPERATIONS.md) | Codebase map, test strategy, migrations, diagnostics, and release runbook. |
| [Roadmap](docs/ROADMAP.md) | Phased next steps and criteria for safely expanding capability. |
| [Phase 1 UI validation](docs/PHASE1_UI_VALIDATION.md) | Desktop and mobile anonymous-state validation; owner-flow validation remains deferred. |
| [GitHub sync record](docs/GITHUB_SYNC.md) | Previous documentation synchronization traceability. |

## Quick start

```bash
pnpm install
pnpm dev
```

Open the local URL printed by the dev server. The public token viewer can be used without signing in. Saving an IPS, recording a paper simulation, or reviewing private history requires the project’s configured Manus OAuth login.

```bash
pnpm test
pnpm check
pnpm build
```

The current test suite covers deterministic policy boundaries, the public data adapter including cache/fallback behavior, protected persistence contracts, and frontend review states.

## Non-negotiable boundary

> A policy pass can authorize a **simulated** proposal lifecycle only. It cannot grant a model, user interface, tool, or data adapter the ability to execute a real transaction.

Ledgerline currently exposes only `chain.read` and `market.read` for public data. It does not request wallet addresses, private keys, signatures, exchange credentials, or an `execution.request` scope. Simulated adapter records contain no credentials.

## References

[1] [Blockscout API documentation](https://docs.blockscout.com/devs/apis)

[2] [DexScreener API reference](https://docs.dexscreener.com/api/reference)

[3] [NVIDIA, “NVIDIA AVO Reaches 100% on ARC-AGI-3”](https://developer.nvidia.com/blog/nvidia-avo-reaches-100-on-arc-agi-3-demonstrating-a-frontier-level-general-purpose-architecture-for-long-horizon-autonomous-agents/)
