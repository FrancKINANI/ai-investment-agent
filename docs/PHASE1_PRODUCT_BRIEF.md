# Ledgerline Phase 1 Product Brief

**Status:** Implemented research-agent workflow; authenticated owner-flow validation pending

## The product in one sentence

**Ledgerline is a private crypto/on-chain research agent that turns a token question and live public evidence into an explainable, IPS-gated research brief and, only where permitted, a paper-simulation next step.**

It is personal infrastructure for one owner. It is not a public advisory product, a custody product, or a trading bot.

## Primary user and job

| Element | Phase 1 decision |
| --- | --- |
| Primary user | The owner operating a private crypto/on-chain investment process. |
| Core job | Convert a token question into a source-bound research brief that explains evidence, risks, unknowns, policy status, and the permitted next step. |
| Initial universe | Ethereum ERC-20 contracts supplied by the owner. |
| Input | A contract address plus a concrete diligence question; an owner IPS is optional for research but required to advance any paper proposal. |
| Output | A structured research brief, source and freshness metadata, a deterministic IPS assessment, a simulation-only advancement state, and an owner-scoped audit record. |
| Explicit exclusion | Personalized trade instruction, price target, wallet connection, private key, signing, exchange key, order placement, or live execution. |

## Owner journey

The owner first saves an Investment Policy Statement that defines approved contracts and capital/risk boundaries. The owner then asks a research question about an Ethereum ERC-20 contract. Ledgerline retrieves the available public Blockscout and DexScreener evidence server-side, asks the research model to reason only from that packet, validates the returned structure, and records the report, source metadata, policy result, and proposal state.

The resulting brief separates what is observed from what is unknown. It displays the research thesis, risks, potential catalysts to verify, an explicit next diligence step, and the deterministic policy assessment. A contract in the owner’s approved universe can be eligible for an **owner-initiated paper simulation**. It never becomes eligible for a live transaction in Phase 1.

## Authority model and measurable gates

| Gate | Requirement | Outcome when not met |
| --- | --- | --- |
| Evidence gate | A valid ERC-20 contract and successful Blockscout public response are required. DexScreener data is optional and surfaced as unavailable when absent. | No brief is produced from invented metrics. |
| Structured-output gate | The model response must parse and satisfy the required research-report schema. | The report is rejected and the owner is asked to retry. |
| Policy gate | A saved IPS must include the contract in its approved universe before a proposal can advance beyond review. | Research is retained as a review item only. |
| Authority gate | The proposal must request only `proposal.write` and declare simulation-only mode. | Any `execution.request` is deterministically blocked by the shared runtime. |
| Owner gate | Research persistence and paper simulation require authenticated owner context. | Anonymous visitors can inspect the public viewer, but cannot create a private research trail. |
| Promotion gate | A paper simulation is a review artifact, not a promotion to execution. | No wallet, signing, exchange, or transaction surface exists. |

## Phase 1 implementation boundary

The live evidence packet presently contains ERC-20 metadata, holders, explorer-supplied price/market-cap fields where available, and the highest-liquidity DexScreener pair where available. The model is instructed not to infer unsupported protocol facts, news, on-chain flows, token economics, or investment instructions from this limited packet. Missing values and unknowns are deliberately visible.

The default model route is server-side `gpt-5-mini` using strict JSON-schema output. The client never receives model credentials. Every successful private analysis creates an agent-run, operator-action, and justification-awareness record so the owner can reconstruct what was asked, what data was used, how fresh it was, and why the proposal remained eligible or under review.

## What Phase 1 proves before future autonomy

Phase 1 is a reliability and operating-discipline test. It proves that Ledgerline can collect bounded public evidence, produce readable research without inventing unavailable figures, retain a reviewable trail, respect a user-owned IPS, and stop before execution. It does not prove predictive accuracy, strategy robustness, custody safety, or readiness for real capital.

Any future Sailor mandate, CEX connector, Binance Agent OS integration, or constrained execution capability requires a new phase specification, a separate threat model, explicit owner authorization, simulation evidence, and a fresh implementation review. It cannot be enabled by a model response, a policy save, or a UI toggle.

> **Research and analysis only; not personalized financial advice.**

## References

[1] [Blockscout API documentation](https://docs.blockscout.com/devs/apis)

[2] [DexScreener API reference](https://docs.dexscreener.com/api/reference)
