# Ledgerline Autonomy and Execution Contract

**Status:** Design contract for the autonomous operating-system redesign. No venue, wallet, signing key, or live-execution adapter is connected by this document.

## Product intent

Ledgerline is evolving from a research-and-paper-simulation workspace into a **multi-agent investment operating system**. A supervising agent coordinates specialised discovery, macro, on-chain, risk, portfolio, venue, execution, and audit agents. The system can continuously look for candidate projects, tokens, and markets; compare them against policy; and manage configured mandates across an active trading wallet and a long-term investment wallet.

The owner can place each venue-and-wallet mandate in either **simulation** or **real** mode. Real mode is a constrained authority setting, not a global toggle and not an instruction to execute every agent proposal.

> **No model, agent, or web client may possess a private key, exchange secret, withdrawal permission, or unrestricted transaction authority.**

## Mandate hierarchy

| Layer | Purpose | May change real-money authority? |
| --- | --- | --- |
| Owner constitution | Defines assets, venues, wallet roles, capital ceilings, approved strategies, risk thresholds, and emergency controls. | Yes; owner only. |
| Wallet mandate | Binds one wallet role to a subset of venues, asset classes, and a mode. It defines per-order, daily, and drawdown limits. | Yes; owner only. |
| Strategy envelope | Defines the agent family, market universe, frequency, execution style, and allowed adaptive parameters for one strategy. | Only inside owner-defined bounds. |
| Agent runtime | Researches, proposes, scores, routes, submits a simulated action, or—in a live mandate—requests a venue action inside the envelope. | No; it cannot widen its own authority. |
| Venue adapter | Normalises market data, account state, order status, simulation, and permitted action requests for a specific platform. | No; it rejects any action outside the mandate. |

## Wallet roles

The owner requested two principal wallets. Ledgerline will support both as first-class roles, each with its own venue connections and policy envelope.

| Role | Typical objective | Default live envelope | Agent-managed behavior inside the envelope |
| --- | --- | --- | --- |
| **Trading wallet** | Tactical, shorter-horizon opportunities and active order management. | Small order and daily notional caps, venue allow-list, approved symbols, bounded open-order count, automatic cancellation on policy breach. | Scan, propose, place/cancel permitted orders, adjust non-risk-increasing working orders, and rebalance only within caps. |
| **Investment wallet** | Long-term holdings, accumulation, and low-turnover allocation. | Tighter concentration and turnover limits, a slower cadence, approved assets/protocols, and higher confirmation/audit threshold. | Monitor, propose, perform approved periodic allocation actions, and manage only inside the long-term envelope. |
| **Future custom role** | Treasury, stablecoin yield, hedging, experimental, or tax-reserve mandates. | Disabled until a separately named owner mandate exists. | Never inherits authority from another wallet. |

“Agents can edit all wallets” is implemented as **bounded mandate management**: agents may alter watchlists, research priorities, model routes, order parameters, and eligible actions only within an owner-defined envelope. An agent cannot create a wallet, attach a venue, enable real mode, raise a cap, add unrestricted assets, alter withdrawal settings, rotate credentials, or remove an emergency stop.

## Dual-mode control

Each `{wallet role × venue × strategy}` combination has a separate mode and immutable history.

| Mode | Adapter behavior | Authority |
| --- | --- | --- |
| **Simulation** | Uses market data and paper-fill rules; creates no signed request and no external order. | Full autonomous research, proposal, and simulated lifecycle. |
| **Armed** | Validates account/market readiness and produces an exact action preview. | No external order; used for pre-flight testing and owner review. |
| **Real** | May send a specific permitted action to a live adapter only after policy, risk, idempotency, and venue checks pass. | Limited to the mandate. Any action outside it is blocked and logged. |
| **Paused** | Stops new actions and cancels or escalates according to the owner’s preconfigured safe-stop rule. | No new action authority. |

Switching from simulation or armed mode to real mode must be an owner-authenticated configuration change, must name the affected wallet and venue, and must record the cap, scope, and effective time. An agent may transition downward to **paused** or **simulation** when safety rules require it, but cannot transition upward to real mode.

## Venue-adapter model

Ledgerline should not claim to support “all venues” through one generic credential. It requires a pluggable adapter registry, with each adapter exposing a common contract and a venue-specific security profile.

| Adapter family | Examples | What the adapter must isolate | Initial status |
| --- | --- | --- | --- |
| Centralised exchange | Binance and future supported exchanges | Read-only account data, trading credential, order lifecycle, rate limits, order-status reconciliation, and withdrawal-disabled policy. | Disconnected; simulated adapter first. |
| On-chain execution | EVM DEXs, lending, yield, and smart-account/mandate systems | Chain ID, signer/mandate boundary, contract allow-list, approvals, gas limits, simulation, receipts, and reorg/finality tracking. | Disconnected; read-only data adapter exists today. |
| Prediction market | Polymarket and future supported markets | Market eligibility, outcome token, signed-order boundary, balances/allowances, CLOB order lifecycle, and on-chain settlement status. | Disconnected; simulated adapter first. |

For Binance, secure API methods are signed and use distinct permission types; its documentation explicitly separates `TRADE` from `USER_DATA` and warns that API secrets are sensitive.[1] Binance also warns that a timeout can leave execution status unknown, requiring an explicit status query rather than treating an error as a failed order.[2] Ledgerline therefore requires client-generated idempotency keys, append-only order intents, reconciliation before retry, and a separate read-only account channel.

For Polymarket, orders are signed and submitted to a CLOB, while matched trades settle on Polygon.[3] Its documented lifecycle includes delayed, matched, mined, confirmed, retrying, and failed states.[4] A future Polymarket adapter must therefore model order acknowledgement separately from settlement finality; it cannot mark a prediction-market trade complete when an order is merely submitted.

## Agent topology and authority

| Agent | Primary responsibility | Permitted output |
| --- | --- | --- |
| Supervisor | Coordinates the operating loop, detects conflicts, pauses unsafe workflows, and maintains trajectory awareness. | Task assignments, escalations, and pause recommendations. |
| Discovery | Continuously scans configured sources for candidate assets, protocols, and markets. | Candidate cards with evidence provenance and freshness. |
| Macro / regime | Characterises market regime and broader constraints. | Regime assessment and confidence. |
| On-chain / fundamentals | Evaluates token, protocol, liquidity, and on-chain evidence. | Evidence packet and diligence gaps. |
| Risk | Independently checks concentration, liquidity, venue, smart-contract, and mandate limits. | Pass, review, or veto. |
| Portfolio | Tracks wallet-role exposure, cash reserves, positions, and allocation drift. | Rebalance proposal constrained by the relevant wallet mandate. |
| Venue / execution | Translates a permitted action into adapter-specific paper or live instructions and reconciles status. | Simulated fill, armed preview, or bounded live action request. |
| Audit | Persists decisions, evidence, policy checks, mode changes, actions, venue acknowledgements, and final outcomes. | Immutable event trail only. |

## Non-negotiable execution safeguards

1. **Private keys never enter the model context, browser, audit payload, or general database fields.** For on-chain real mode, use a purpose-built non-custodial mandate or delegated signer design; for CEX real mode, use a dedicated trading credential with withdrawals disabled and a distinct read-only credential where supported.
2. **Every live action needs deterministic pre-trade checks.** These include wallet role, venue allow-list, mode, asset allow-list, order-size cap, daily notional cap, concentration, reserve, drawdown, available balance, open-order count, rate limit, and idempotency status.
3. **Every action is stateful until reconciled.** A venue acknowledgement does not equal execution; reconciliation must observe venue status and, where relevant, chain confirmation before finalising the audit event.
4. **The global pause is immediate and owner-controlled.** It prevents new live action requests. Venue-specific stop behavior, including cancellation rules, must be documented before a real mandate is armed.
5. **Agents may reduce risk autonomously but cannot widen authority autonomously.** They may pause, cancel eligible open orders, or move a mandate down to simulation. They may not increase capital, change wallet role, add a venue, enable real mode, or change credential/withdrawal settings.

## Execution-readiness gates

No real venue can be enabled merely because a UI switch exists. The owner must separately approve each adapter after all gates are met.

| Gate | Evidence required |
| --- | --- |
| Adapter specification | Official API/contract capabilities, scopes, signing model, rate limits, failure semantics, and jurisdiction/availability review. |
| Threat model | Credential, signer, smart-contract, CLOB, replay/idempotency, settlement, and emergency-stop threats documented and reviewed. |
| Secret isolation | Credentials stored server-side through the project secret mechanism; no private key is stored in a general application record. |
| Simulation coverage | Happy-path, rejected order, timeout/unknown status, partial fill, cancel, reconnect, rate-limit, and reconciliation cases tested. |
| Owner mandate | Named wallet role, venue, approved assets, real-mode expiry, order/daily caps, risk constraints, and revocation action stored immutably. |
| Arming ceremony | Owner verifies the exact venue account and permissions, enables real mode for that mandate, and records the effective scope. |
| Runtime monitoring | Health checks, reconciliation, alerting, persistent audit trail, and a tested global pause path are operating. |

> **Research and analysis only; not personalized financial advice. Future live actions must be explicitly authorized within the owner’s selected mandate, and any actual trade placed on the owner’s behalf requires a separate confirmation in the conversation at the time of execution.**

## References

[1] [Binance Developer Docs — General WebSocket API Information](https://developers.binance.com/en/docs/products/spot/web-socket-api)

[2] [Binance Developer Docs — General REST API Information](https://developers.binance.com/en/docs/products/spot/rest-api)

[3] [Polymarket Documentation — Trading Overview](https://docs.polymarket.com/trading/overview)

[4] [Polymarket Documentation — Order Lifecycle](https://docs.polymarket.com/concepts/order-lifecycle)
