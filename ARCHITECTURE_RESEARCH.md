# Research Notes: AVO and Agent OS Patterns

This product upgrade uses the publicly described **patterns** of NVIDIA AVO and Binance Agent OS, rather than presenting itself as an implementation of either product.

| Source pattern | Verified observation | Ledgerline adaptation |
| --- | --- | --- |
| AVO long-horizon harness | NVIDIA describes a loop of context inspection, planning, implementation, evaluation, persistent memory, tool use, and supervisory intervention when work stagnates. [1] | Create an agent-run model with explicit observation, hypothesis, proposal, simulated evaluation, and supervisor/review checkpoints. |
| Model-agnostic harness | NVIDIA’s example distinguishes the surrounding agent system from the model itself. [1] | Treat models as replaceable providers selected by capability, cost, and risk tier rather than coupling workflows to a single model. |
| Standardized financial tool layer | Binance describes Agent OS as a layer connecting AI applications to market data, accounts, trading, wallets, payments, and on-chain capabilities. [2] | Define tool contracts and permissions separately from agent reasoning. The MVP will visualize these tool scopes without creating a live connection. |
| User-controlled permissions | Binance says users can configure permissions, dedicate a subaccount, and revoke access. [2] | Maintain an execution boundary: no connected wallet or exchange credentials in the MVP; any future connector must be capability-scoped, revocable, and visible in the control plane. |
| MCP compatibility | Binance says its Agent OS includes MCP support and documents a compatible Streamable HTTP endpoint. [2] | Keep the agent/tool registry transport-agnostic, with a future MCP adapter and explicit tool approval model. |

## Non-negotiable product boundary

Ledgerline remains **simulation-first**. The provider layer can expose model and tool configurations, while the policy engine remains deterministic and the execution adapter stays disabled. A model may formulate a proposal; it must never directly invoke an execution capability.

## References

[1] [NVIDIA, “NVIDIA AVO Reaches 100% on ARC-AGI-3”](https://developer.nvidia.com/blog/nvidia-avo-reaches-100-on-arc-agi-3-demonstrating-a-frontier-level-general-purpose-architecture-for-long-horizon-autonomous-agents/)

[2] [Binance, “Binance Introduces Agent OS to Connect AI Applications to Financial Infrastructure”](https://www.prnewswire.com/apac/news-releases/binance-introduces-agent-os-to-connect-ai-applications-to-financial-infrastructure-302856314.html)
