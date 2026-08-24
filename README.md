# Ledgerline

> **A conversation-first, policy-governed personal crypto/on-chain research and paper-simulation agent.**

Ledgerline is private personal infrastructure for asking a concrete question about an Ethereum token, reviewing a source-bound AI research brief, checking the idea against an Investment Policy Statement (IPS), and—where the IPS permits—initiating a paper simulation. The dashboard, audit trail, and lineage records support that agent workflow; they are not the product’s primary purpose. **AI systems can analyse and propose but cannot trade, sign, connect a wallet, or override deterministic policy controls.**

## Current status

| Capability | Status | Notes |
| --- | --- | --- |
| Conversation-first token research agent | Available | Authenticated owner submits an Ethereum contract and a diligence question; model response is constrained to supplied public evidence and strict structured output. |
| Read-only Ethereum token viewer | Available | Public Blockscout and DexScreener data, sourced server-side with bounded caching. |
| IPS editor | Available | Stores concentration, reserve, transaction, daily mandate, and approved-contract limits per owner. |
| Paper simulations | Available | Creates a durable, policy-bound simulation run; no execution adapter exists. |
| Research lifecycle | Available | Persists and reviews lineage, evaluation, outcome, and awareness records. |
| AI provider registry | Available | Provider-aware model catalog and role/policy abstractions. |
| Live execution, custody, wallet signing | **Unavailable by design** | Not an MVP feature and not exposed by the application. |
| Browser owner-flow verification | Deferred | The implementation and contract tests are complete; a Cloudflare-gated owner session still needs a manual final pass. |

## Documentation map

| Document | Purpose |
| --- | --- |
| [Getting started](docs/GETTING_STARTED.md) | Local setup, first run, and the first safe workflows. |
| [Phase 1 product brief](docs/PHASE1_PRODUCT_BRIEF.md) | The target user, research-agent job, owner journey, authority model, and measurable Phase 1 gates. |
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

> A policy pass can authorize a **paper** proposal only. It cannot grant a model, user interface, tool, or data adapter the ability to execute a real transaction.

Ledgerline currently exposes only `chain.read` and `market.read` for public data. It does not request wallet addresses, private keys, signatures, exchange credentials, or an `execution.request` scope.

## References

[1] [Blockscout API documentation](https://docs.blockscout.com/devs/apis)

[2] [DexScreener API reference](https://docs.dexscreener.com/api/reference)

[3] [NVIDIA, “NVIDIA AVO Reaches 100% on ARC-AGI-3”](https://developer.nvidia.com/blog/nvidia-avo-reaches-100-on-arc-agi-3-demonstrating-a-frontier-level-general-purpose-architecture-for-long-horizon-autonomous-agents/)
