# TradingAgents Runtime Contract

## Purpose

Ledgerline’s agent fabric is a **simulation-only investment research and paper-proposal system**. It adapts the user-specified TradingAgents workflow into a visible, owner-governed runtime: analysts gather bounded evidence, researchers debate it, a trader drafts a paper proposal, risk guardians challenge it, and a fund manager determines whether the proposal may enter the owner review queue.

The fabric is not a route to autonomous live trading. A model output cannot alter a wallet mode, sign a transaction, create a venue credential, or bypass the deterministic IPS and proposal gates.

## Protected core roles

| Layer | Protected role | Authority in Ledgerline | Removable? |
| --- | --- | --- | --- |
| Coordination | Supervisor | Maintains the shared research brief, delegates bounded tasks, and records the evolving agent graph. | No |
| Analysts | Fundamental analyst | Tests project fundamentals against available evidence. | No |
| Analysts | Sentiment analyst | Summarizes source-bound market/community signals with confidence and unknowns. | No |
| Analysts | Technical analyst | Interprets available price/liquidity observations; does not forecast unsupported values. | No |
| Analysts | News analyst | Distinguishes source-dated news and catalysts from unverified claims. | No |
| Research | Bull researcher | Builds the strongest evidence-supported positive thesis. | No |
| Research | Bear researcher | Builds the strongest evidence-supported adverse thesis. | No |
| Decision | Trader | Converts the research packet into a **paper-only** action proposal. | No |
| Risk | Risk guardians | Independently veto or place a proposal under review. | No |
| Final review | Fund manager | Applies policy and evidence gates before the owner review queue. | No |
| Deterministic control | IPS / policy engine | Evaluates non-negotiable rules outside model control. | Not an agent |

The owner may select an available server-side model for every role. Changing a model route does not expand tool permissions, capital limits, cadence, wallet authority, or execution scope.

## Optional subagents

The Supervisor can propose optional subagents such as on-chain diligence, macro/regime, protocol security, liquidity, options, or venue specialists. Optional agents must declare a parent role, a bounded purpose, a model route, read-only tool scopes, and a maximum lifecycle. Their creation, pause, retirement, and any generated finding are immutable audit events.

The Supervisor may add or retire optional subagents inside a configured capacity limit. It cannot delete a protected role, mutate the IPS, grant a new tool scope, activate a schedule, or change a wallet/venue mode. Those actions remain owner-only.

## Shared research state and chat

The supervisor chat is the owner’s operating surface. Each owner message creates a durable conversation turn. Specialist activity appends visible evolution events containing the assigned role, purpose, model route, evidence references, conclusion, uncertainty, and resulting state. The shared state is a research packet, not a chain of hidden model thoughts.

## Watchlists and discovery

An owner watchlist holds named assets, EVM contract addresses where applicable, venue/category labels, discovery criteria, and lifecycle state. Discovery can scan only watchlist scope in the initial release.

“Best” means **best match to owner-configured and source-supported criteria**, not a return prediction. The discovery result must record the exact public sources, freshness, missing inputs, score components, confidence, and policy result. It must never fabricate a token balance, liquidity figure, price, trade fill, or connected account.

## Scheduled discovery contract

| Mode | Cadence | Work | Initial activation |
| --- | --- | --- | --- |
| Signal scanner | Every six hours | Reads configured watchlist evidence, detects material changes, and creates candidate/evolution records. | Optional, disabled by default |
| Deep discovery | Daily | Runs a bounded analyst/researcher synthesis over the configured watchlist and saves an owner-reviewable paper candidate. | Default selection, disabled by default |

The schedule is a durable, owner-scoped background job. It must be created only after the site is deployed, must target an authenticated scheduled callback, must be idempotent, and must be identified by a stored scheduler task identifier rather than client request fields. The callback may create research findings and paper proposals only; it cannot invoke live execution.

## Owner-only boundaries

| Owner-only operation | Why |
| --- | --- |
| Enable, pause, change, or delete a discovery schedule | Controls cost, cadence, and external calls. |
| Create/edit a watchlist and discovery criteria | Defines the research universe. |
| Change wallet/venue authority or real-mode status | Financial authority must not be model-controlled. |
| Create, delete, or modify a venue credential | Credentials and signing material never enter the agent context. |
| Approve, reject, or settle a paper proposal | Preserves owner accountability for the simulation lifecycle. |

> **Research and paper simulation only; not personalized financial advice.**
