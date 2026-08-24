# Ledgerline Agent Fabric Architecture

## Design objective

Ledgerline Agent Fabric is an **AI-native, simulation-first investment operations layer**. It allows models from current provider families to be assigned to specialist roles while preventing a model from becoming an unchecked execution authority. The architectural premise is that a capable model is only one part of the system: durable progress needs memory, tools, feedback, evaluation, and supervisory control.[1]

## Runtime loop

The implemented model follows an AVO-inspired operating sequence: **observe → hypothesize → simulate → evaluate**. Research and on-chain roles collect structured evidence; allocation and risk roles formulate and adjudicate a candidate; the supervisor identifies stalled or inconsistent trajectories; the deterministic policy boundary decides whether the proposal may continue in the paper environment.[1]

| Layer | Responsibility | Authority | Prohibited action |
| --- | --- | --- | --- |
| Model provider | Generate structured analysis for a named role | Reason and propose | Invoke a wallet or an exchange directly |
| Agent role | Run a bounded research, on-chain, allocation, risk, or supervision task | Read authorised evidence; write a proposal | Override policy |
| Tool registry | Declare the scopes an agent could use | Express `market.read`, `chain.read`, `portfolio.read`, and `proposal.write` | Silently add a capability |
| Policy engine | Evaluate deterministic concentration, reserve, risk, and operating rules | Pass, review, or block a candidate | Delegate a hard limit to the model |
| Simulation adapter | Evaluate a permitted candidate as a paper event | Create auditable paper results | Submit a live order |
| Execution adapter | Reserved for a later independent phase | None in the current MVP | Exist as an accessible scope |

## Provider abstraction

The server reads the project’s **live model catalog** and groups currently available models by provider family. The UI therefore does not invent a single proprietary “agent model”; it routes named roles to current OpenAI, Anthropic, Google, or custom/MCP families. A future external provider must be connected server-side and must never expose credentials to the browser.

| Provider path | Current state | Intended use |
| --- | --- | --- |
| Built-in provider catalog | Implemented, read-only | Select a suitable current model family per agent role |
| Custom model provider | Architecture-ready | Server-side secret and provider adapter required |
| MCP tool endpoint | Architecture-ready | Explicit user-authorised tool registry required |
| Binance Agent OS / MCP | Not connected | Potential future execution/data adapter behind dedicated scopes |

## Web3 security posture

The command center now surfaces an explicit simulated account envelope: an EVM network context, a research subaccount identity, a read-only authority mode, and a paper-NAV context. This is intentionally **not a real wallet connection**. Binance describes its Agent OS as a standardised layer for market data, wallets, trading, payments, and on-chain tools, with user-controlled permissions, dedicated subaccounts, and revocation.[2] Ledgerline adopts these control concepts but does not connect to Binance or activate any external execution path.

> **Invariant:** no agent is ever granted `execution.request` in the simulation-first runtime. A policy pass only allows a paper proposal; it does not permit a real transaction.

## Activation path for a real external adapter

Before connecting Binance Agent OS, a wallet, an exchange, or a custom MCP endpoint, the owner must first specify the exact provider and supply the relevant credentials or complete the provider’s authorisation process. The implementation should then add a server-side, capability-scoped adapter with an explicit subaccount or wallet identity, read-only validation, revocation verification, policy-gated request handling, and an audit record that retains the input snapshot, policy version, proposal, tool call, and result. The browser must never hold provider secrets, private keys, or exchange credentials.

## Verification performed

The release includes unit tests that confirm the runtime blocks execution requests even if policy passes, blocks all proposals during an owner pause, and permits only a policy-passing paper proposal. Type checking and production compilation also pass.

## References

[1] [NVIDIA, “NVIDIA AVO Reaches 100% on ARC-AGI-3”](https://developer.nvidia.com/blog/nvidia-avo-reaches-100-on-arc-agi-3-demonstrating-a-frontier-level-general-purpose-architecture-for-long-horizon-autonomous-agents/)

[2] [Binance, “Binance Introduces Agent OS to Connect AI Applications to Financial Infrastructure”](https://www.prnewswire.com/apac/news-releases/binance-introduces-agent-os-to-connect-ai-applications-to-financial-infrastructure-302856314.html)
