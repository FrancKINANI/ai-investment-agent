# Public Data and Stack Research

## Decision summary

Ledgerline’s initial data path uses a **two-source, public, read-only combination**: **Blockscout** is the primary EVM explorer and token-metadata source, while **DexScreener** is the primary DEX market-metrics source. This is a deliberate split. Explorer records and DEX market records solve different problems, and exposing both provenance labels makes the boundary legible to the operator.[1] [2]

| Requirement | Selected source | Why it is selected | Initial cost basis | Permission model |
| --- | --- | --- | --- | --- |
| ERC-20 contract metadata, holders, explorer reference price, volume, market-cap fields | Blockscout public Ethereum endpoint | It returns token-level explorer data for the supplied EVM contract and supports an inspectable explorer link.[1] | No user API key or provider subscription is configured in this release; hosting and outbound-network costs are separate. | Server performs a public GET only. It has no wallet, signature, exchange, or execution permission. |
| Price, DEX liquidity, 24-hour volume, change, and pair identity | DexScreener `token-pairs/v1/{chainId}/{tokenAddress}` | Its documentation lists token-pair pool data and a published 300-requests-per-minute limit for this endpoint family.[2] | No user API key or provider subscription is configured in this release; hosting and outbound-network costs are separate. | Server performs a public GET only. It has no wallet, signature, exchange, or execution permission. |
| Owner-approved token universe | Ledgerline IPS database record | The owner explicitly enters the asset contract before it becomes an IPS candidate. | Included in the application database. | Authenticated owner write; no external authority granted. |

> **Initial selection:** Blockscout + DexScreener is appropriate for the low-volume, on-demand operator viewer because it provides real source data without asking the user for credentials or creating custody risk. It is **not** the final production data architecture for high-frequency monitoring or execution.

## Operating characteristics and reliability policy

The current viewer makes an on-demand server-side request only after an operator supplies a valid Ethereum ERC-20 contract. It does not poll in the browser and does not manufacture values. DexScreener documents a 300-requests-per-minute limit for its token-pair endpoint family.[2] Blockscout documents a broader API surface, including REST, JSON-RPC, ETH-compatible RPC, and GraphQL, while its universal Pro API requires a key; the first release intentionally uses the observed chain-specific public endpoint rather than its credentialed Pro service.[1]

| Failure or data-quality condition | Current behavior | Rationale |
| --- | --- | --- |
| Blockscout request fails or returns non-success | The viewer returns an explicit unavailable error and renders no token metrics. | Contract identity and explorer provenance are required; there is no safe synthetic substitute. |
| DexScreener request fails or returns no pool | Token metadata remains visible when Blockscout succeeds; market fields show **Unavailable** and the source is labeled unavailable. | Separates missing market data from missing chain identity. |
| Multiple DEX pools exist | The server selects the returned pool with the highest USD liquidity and displays its DEX identity. | Provides an explicit, reproducible selection rule, while reminding the operator that liquidity can change. |
| Upstream value is absent | The individual field renders **Unavailable**, never a seeded demo number. | Prevents a missing public value from looking like a real metric. |
| Rate-limit or temporary availability risk | The UI is on-demand rather than polling, exposes source and fetch time, and preserves an unavailable state. | Appropriate for a personal, low-volume MVP. A production watcher should introduce server caching, provider monitoring, and a contracted data service. |

The implementation fetches both sources in parallel from the server and records a timestamp alongside the response. The public sources are **best-effort sources, not a source-of-truth valuation service**. DEX liquidity and price data are pool-specific, and explorer-supplied fields may differ from a market-data vendor’s methodology. The product therefore surfaces both the selected DEX identity and the source labels rather than blending them into an untraceable “price.”

## Implementation boundary

The viewer accepts a contract address; it does not request a wallet address or infer ownership. Its only declared scopes are `chain.read` and `market.read`. The application does not expose `execution.request`, wallet connection, private-key handling, exchange credentials, or signing capability.

| Data plane | Current implementation | Explicitly excluded |
| --- | --- | --- |
| On-chain viewer | Public ERC-20 contract data and DEX pool metrics, fetched server-side | Wallet balances, personal transaction history, signing, trading, bridging, custody |
| IPS | Authenticated owner records concentration, reserve, transaction, daily-mandate, and approved-contract limits | Auto-changing policy, implicit asset approval, live execution mandate |
| Operator history | Authenticated owner actions and paper-simulation starts are persisted | Shared/public history, model-authorized execution records |

## Stack recommendation

The current **React + TypeScript + Express + tRPC + Drizzle/MySQL** application stack is a sound foundation for the personal control plane, authenticated audit records, deterministic policy editing, and read-only data aggregation. It is not the complete long-horizon agent runtime. The target architecture should preserve this application as the human-facing governance layer and add a separately deployable orchestration/worker layer only when scheduled data collection, long-running simulations, or agent trajectories require it.[3]

| Layer | Recommended status | Rationale |
| --- | --- | --- |
| Operator console | Keep current React + TypeScript UI | Well-suited to a private, inspectable governance interface. |
| API and policy boundary | Keep Express + tRPC + Zod | Typed contracts and explicit protected procedures fit policy-first controls. |
| Durable operational record | Keep Drizzle + MySQL initially | Supports IPS versions, actions, paper runs, lineage, evaluations, and outcomes. |
| Live data adapters | Keep server-side TypeScript adapters; add cache/monitoring before high-volume use | Keeps external calls and future credentials out of the browser. |
| Orchestration | Defer a LangGraph-style or equivalent worker service until the research loop needs durable background execution | Separates long-running reasoning from the control plane. |
| Execution | Keep unavailable in this product phase | Requires separately reviewed mandates, credentials, revocation, monitoring, and compliance controls. |

For the present scope, **do not replace the whole stack**. Complete the data-backed, policy-governed control plane first. Adopt a dedicated worker service only after the IPS, data provenance, simulation history, and review workflows are stable.

## References

[1] [Blockscout API documentation](https://docs.blockscout.com/devs/apis)

[2] [DexScreener API reference](https://docs.dexscreener.com/api/reference)

[3] [LangGraph deployment documentation](https://docs.langchain.com/oss/python/langgraph/deploy)
