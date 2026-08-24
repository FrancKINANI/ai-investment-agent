# Roadmap

## Guiding rule

Ledgerline should expand **authority more slowly than observability**. Each new capability must preserve the separation between reasoning, deterministic policy, simulation, and execution.

## Phase 0 — current control plane

The current release provides owner-scoped IPS persistence, paper simulations, research records, public read-only Ethereum token metrics, public-source caching, and an execution-sealed agent architecture. The remaining external verification is the manual signed-in browser workflow.

## Phase 1 — strengthen evidence, not execution

| Outcome | Candidate work | Exit criterion |
| --- | --- | --- |
| Better research provenance | Capture data snapshots, source timestamps, and policy version with each research record. | A reviewer can reconstruct why a paper record was created. |
| Better data reliability | Introduce server-side cache metrics, health checks, rate handling, and a contracted provider option. | Upstream failures are observable and never silently mixed with stale values. |
| Better workflow review | Add filtered audit timelines and export of owner-owned records. | An owner can inspect a coherent history without manual database access. |

## Phase 2 — durable agent orchestration

Do not add long-running agents inside the web request path. Add a separately deployable worker/orchestration layer only when a schedule, a queue, and durable task state are necessary. The worker should read policy and evidence, create proposals, attach outputs to the audit record, and remain unable to execute transactions.

## Phase 3 — restricted external adapters

Before connecting an exchange, wallet, Binance Agent OS, or MCP tool, require a written adapter specification, explicit scopes, owner consent, revocation, a dedicated subaccount or sandbox, policy gating, and a test environment. Start with `read` scopes; do not add transaction authority merely because an adapter technically supports it.

## Phase 4 — live capability decision

Live execution is a product, security, legal, and operational decision—not a toggle. It should remain unavailable unless the owner defines a documented execution mandate, providers support revocable constrained authority, independent review is complete, monitoring and incident controls exist, and the intended jurisdiction/compliance obligations are addressed.

> A roadmap item is not an approval to act. Every capability changes the threat model and must be reviewed in the implementation context.
