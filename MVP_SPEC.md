# Ledgerline MVP Specification

## Product intent

Ledgerline is a simulation-first personal investment operations dashboard. It converts an Investment Policy Statement into visible controls, presents a paper portfolio, records decision evidence, and makes the system’s operational state legible. The MVP is deliberately not a trading bot: it does not connect to wallets, exchanges, brokers, payment systems, or live market feeds, and it cannot place an order.

> The first success metric is not return. It is whether the owner can understand what the system would do, why it would do it, and which rule would stop it.

## MVP scope

| Capability | MVP behavior | Explicit exclusion |
| --- | --- | --- |
| Operator dashboard | Portfolio posture, reserve ratio, risk budget, open reviews, system health | Multi-user administration |
| Paper portfolio | Local simulated NAV and allocation display | Live balances or tax lots |
| Policy engine | Deterministic hard-limit presentation and pass/review states | Natural-language policy compilation |
| Simulation | “Run paper cycle” creates a local simulated run and journal entry | Live order routing |
| Decision journal | Recent action proposals with timestamps, asset, result, and evidence | Cryptographic notarization or remote persistence |
| Fail-safe controls | Pause/resume simulation; live execution visibly disabled | Automated emergency transactions |
| Data | Static, clearly labelled simulated data | Real-time feeds, oracle data, news ingestion |

## First-principles architecture

The product is structured around four future-proof boundaries even though the MVP is client-only:

1. **Perception boundary.** A future adapter will normalize market and on-chain observations into typed snapshots. The MVP uses fixture snapshots so interface behavior can be tested without credentials or vendor coupling.
2. **Policy boundary.** Rules are deterministic and explainable. A future reasoning layer may propose actions, but it cannot override the policy boundary.
3. **Simulation boundary.** Candidate actions are represented as paper events. Every run receives a simulation identifier and a journal entry.
4. **Execution boundary.** The UI explicitly communicates that live execution is disabled. Future adapters must be separately implemented, separately permissioned, and separately reviewed.

## State model

The minimum domain vocabulary is:

| Entity | Key fields | Purpose |
| --- | --- | --- |
| `Policy` | `id`, `version`, `status`, `rules[]` | Current investment constitution |
| `PolicyRule` | `name`, `current`, `limit`, `state` | Deterministic constraint result |
| `PortfolioSnapshot` | `nav`, `reserveRatio`, `riskBudgetUsed`, `allocations[]` | Point-in-time paper state |
| `SimulationRun` | `id`, `startedAt`, `status`, `checksPassed` | Reproducible paper cycle |
| `DecisionRecord` | `time`, `action`, `asset`, `status`, `evidence`, `runId` | Human-readable audit trail |
| `ControlState` | `paused`, `liveExecutionEnabled` | Fail-safe operator controls |

## Safety gates

No future live adapter should be enabled until the following gates are met:

- The IPS is versioned and the active version is displayed at every decision point.
- All action proposals have deterministic policy results before execution is considered.
- Simulation coverage exists for every new action type.
- The owner can pause the agent and revoke execution authority without navigating through an analysis flow.
- Logs preserve the input snapshot, policy version, proposed action, policy result, and final outcome.
- API keys, private keys, and withdrawal permissions are never accepted by the client-only MVP.

## Cost and deployment choice

The MVP uses static hosting and browser-local state. This removes recurring worker costs, database costs, exchange fees, and secret management while the domain model is still changing. When persistence, scheduled ingestion, or multi-device access becomes necessary, the next economical upgrade is a small backend with authenticated storage and scheduled jobs. Live execution should remain a later phase, after simulation evidence and threat review.

## Acceptance criteria

The MVP is acceptable when an owner can load the dashboard, identify the current policy and simulation-only status, run a paper cycle, see a new journal record, pause the paper agent, observe that a run is refused while paused, and inspect the visible rule states. The build must pass TypeScript validation and production compilation. The interface must remain usable on a narrow mobile viewport, even though desktop is the primary operator experience.

## Deferred roadmap

**Phase 1:** Add typed fixture modules and pure policy-evaluation functions with unit tests. Add local-storage persistence for policy, control state, and decision journal.

**Phase 2:** Add authenticated backend storage, a real data-ingestion adapter, and scheduled paper evaluations. Keep execution disabled.

**Phase 3:** Add a sandbox adapter for one narrow on-chain use case. Require explicit simulation evidence and owner approval before any mandate is considered.

**Phase 4:** Consider a restricted execution adapter only after independent security review, narrow limits, kill-switch testing, and a written go/no-go decision.

## Disclaimer

This software is an engineering prototype for policy-aware simulation and operational review. It is not financial advice, does not promise performance, and must not be treated as a substitute for professional legal, tax, or investment advice.
