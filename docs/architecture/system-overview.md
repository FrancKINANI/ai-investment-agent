# System Overview

Ledgerline is a React and TypeScript private operator workspace backed by Express, tRPC, Drizzle, and PostgreSQL. The client provides a clear agent-operating interface. The server—not the client—enforces authentication, owner scope, memory scope, capability bindings, policy constraints, and the sealed real-capital boundary.

## Workspace map

| Route | User purpose |
| --- | --- |
| `/` | **Mission Control**: research-desk posture, current work, tasks, decision attention, policy and account posture, and audit trace. |
| `/chat` | **Agent Room**: supervisor or individually selected specialist conversations with inspectable shared/private context. |
| `/tasks` | **Tasks**: current, completed, and blocked owner-scoped agent work. |
| `/decisions` | **Decision Desk**: paper-proposal review and the policy context around a decision. |
| `/portfolio` | **Portfolio**: truthful account, connection, and policy posture; legacy Wallets, Mandates, Platforms, and Connections links resolve here. |
| `/activity` | Immutable owner-scoped activity and security signals. |
| `/settings` | Models, protected roles, optional specialists, policy, schedules, and owner-local preferences. |

## Agent and memory architecture

Protected TradingAgents roles are server-defined. They cannot be removed from the interface. An owner may select an active **research** specialist for a direct conversation, but an execution-oriented role is rejected before any message, memory read, or model call.

```text
authenticated owner
  → selected active research agent
  → server-derived bounded context
      ├─ policy context
      ├─ active shared memory
      ├─ active private memory for that exact agent
      └─ recent messages in that exact individual thread
  → model response labelled as research context
  → owner-scoped conversation and activity records
```

The memory store uses three additive tables: `agentIndividualConversations`, `agentMemoryEntries`, and `agentMemoryActions`. Every record is owner-scoped. A memory entry has a scope (`shared` or `private`), a lifecycle status, an optional target agent, content digest, expiry, revision, source reference, and creator type. The audit table preserves promotion and lifecycle transitions without retaining hidden model reasoning.

| Context item | Visibility | Admission and lifecycle |
| --- | --- | --- |
| Shared memory | Eligible research agents for the same owner | Active, non-expired entries only; items are bounded and ordered deterministically. |
| Private memory | One selected research agent and its owner | Must retain an exact target agent ID; never falls back to a broader team scope. |
| Pending promotion | Owner and administrator review only | Still private and excluded from model context until approved. |
| Expired, superseded, or redacted memory | No model context | Retained only according to its recorded lifecycle and audit treatment. |

## Server routers and modules

| Component | Responsibility |
| --- | --- |
| `agentFabric` | Server-defined roles, supervisor conversations, evolution events, model selection, research proposals, and watchlists. |
| `agentMemory` | Focused individual conversations, scoped-memory retrieval, owner-created notes, promotion request/review, and audit events. |
| `policy` | Owner-scoped Investment Policy Statement records. |
| `research` | Public-evidence research with policy-aware checks. |
| `history` and `audit` | Owner-scoped immutable activity, outcomes, provenance, and review records. |
| `live` and `liveAdapter` | Future-facing adapter surfaces guarded by the compile-time venue seal; not an execution path. |

## Authority boundary

Research and paper review remain the active product path. The runtime must fail closed for any real venue mutation. `LIVE_VENUE_MUTATIONS_SEALED = true` is a compile-time control and must be checked before key decryption, mandate reads, venue I/O, or mutation attempts. It is not an environment toggle.

```text
public evidence → bounded research → policy-aware paper review → owner decision record → immutable activity
                                                              └→ real venue mutation: sealed / unavailable
```

The memory router has no live adapter, Binance client, wallet, signing, or key-decryption dependency. Memory cannot create authority. Model output and stored memory are untrusted research reference material, not instructions that can grant tools or bypass server controls.

## Operational conventions

All changes use `feat/*` or `fix/*` branches and reach `staging` through a green pull request. A separate authorised promotion is required before `main`. Schema changes follow the same workflow and may be applied only after the target database has been explicitly identified. No migration creates sample user data as a side effect.

The active database is PostgreSQL with extensions for vector search (pgvector), full-text search, caching (UNLOGGED tables), and scheduling (pg_cron).
