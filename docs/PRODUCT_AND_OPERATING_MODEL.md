# Product and Operating Model

## Product thesis

Ledgerline is a **human-governed investment operations workspace**, not an autonomous trading system. Its purpose is to make a private operator’s policy, research, public data, and paper simulations inspectable in one place. The product treats AI as a bounded contributor to research and proposal generation, while policy and authority remain deterministic and human-controlled.

The core operating loop is **observe → hypothesize → simulate → evaluate → review**. This follows the broad principle that long-horizon agents require external memory, tools, evaluation, and supervisory control rather than unbounded inference alone.[1]

| Principle | Product consequence |
| --- | --- |
| Human mandate first | An owner-defined IPS is the prerequisite for a paper simulation. |
| Deterministic control | A model cannot alter concentration, reserve, transaction, or daily mandate limits. |
| Evidence before promotion | Strategy lineage, hard evaluation, and outcome records are all durable review artifacts. |
| Least authority | Public data uses read-only scopes; no wallet or execution capability exists. |
| Provenance visible | Token metrics include source labels, a fetch time, and live/cached freshness. |

## User roles

Ledgerline currently supports a single authenticated **owner operator**. The owner creates policy, launches paper simulations, records research, and reviews history. The app’s administrator role is available at the template layer, but Ledgerline does not yet expose a multi-user collaborative workflow.

| Role | Can do | Cannot do |
| --- | --- | --- |
| Anonymous visitor | Inspect a public ERC-20 contract through the on-chain viewer. | Save IPS data, record research, read private history, or create a simulation. |
| Authenticated owner | Save the IPS, submit research records, create paper runs, and review private records. | Trade, sign, connect custody, invoke an exchange, or elevate tool scopes. |
| AI/provider adapter | In the architecture, analyse and propose within its assigned role. | Bypass policy or gain an execution authority. |

## Principal workflows

### 1. Establish the mandate

The owner defines an IPS that includes a policy name, maximum concentration, minimum reserve, maximum transaction size, daily mandate, and a list of full Ethereum contract addresses. All percentage limits are stored as basis points. The policy is versioned and marked `simulation` execution mode.

### 2. Inspect a public token

The user pastes a valid Ethereum ERC-20 contract. Ledgerline retrieves token metadata and explorer figures from Blockscout, then DEX liquidity and price data from DexScreener. It displays no default sample price, balance, liquidity, or holder figure; an unavailable upstream is explicitly reported. DexScreener documents token-pair data endpoints and a 300-requests-per-minute rate limit for that endpoint family.[2]

### 3. Run a paper-only simulation

The owner can start a simulation only after an IPS exists. Ledgerline records the paper run, an operator action, and an `action` awareness record. The runtime is marked simulation-only, and there is no execution adapter.

### 4. Build and review research records

The owner can create three research record types. A lineage represents an evolving thesis or strategy branch; a hard evaluation represents a gate assessment; an outcome compares an expected and realized paper result. Each write also creates an awareness artifact for evolutionary, justification, or result context.

## Explicit exclusions

The MVP does not offer investment advice, suitability assessment, broker or exchange routing, custodial services, lending, payments, wallet connectivity, signing, private-key management, or live transaction execution. It is not intended to replace a regulated financial adviser, broker, or portfolio-management system.

## References

[1] [NVIDIA, “NVIDIA AVO Reaches 100% on ARC-AGI-3”](https://developer.nvidia.com/blog/nvidia-avo-reaches-100-on-arc-agi-3-demonstrating-a-frontier-level-general-purpose-architecture-for-long-horizon-autonomous-agents/)

[2] [DexScreener API reference](https://docs.dexscreener.com/api/reference)
