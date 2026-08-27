# Ledgerline

> **A private, owner-controlled multi-agent investment research workspace.**

Ledgerline is an **AI investment operating system for research, review, and simulation**. It helps an owner observe a specialist team, ask focused questions, collect evidence, preserve audit trails, and review paper proposals. It is designed so that **observability grows before authority**: the product can explain what the team knows and why, without claiming it can move real capital.

## Current product state

The default workspace is **Mission Control**, a calm operating view for the research desk, current work, decisions requiring attention, policy posture, and immutable activity. **Agent Room** lets an owner select a specialist for a focused conversation and inspect the memory context used for that discussion. **Tasks**, **Decision Desk**, **Portfolio**, **Activity**, and **Configure** support the rest of the operating loop.

| Capability | Current state | Important boundary |
| --- | --- | --- |
| Mission Control and specialist roster | Available | Shows only authenticated, owner-scoped records. |
| Focused individual-agent conversations | Available after the memory schema is present | Conversations are bound server-side to one non-execution research agent. |
| Shared and private memory | Available after the memory schema is present | Private notes stay with one agent unless explicitly promoted and approved. |
| Research, evidence, policy review, paper proposals | Available | Outputs are research records, not investment advice or execution instructions. |
| Live venue mutation, wallet signing, on-chain action, custody | **Not available** | `LIVE_VENUE_MUTATIONS_SEALED` is a compile-time boundary. |

> **Real-capital status: NO-GO.** Creating configuration records, changing a feature flag, adding a key, or editing a mandate cannot lift the compiled execution seal. A separately authorised unsealing programme is required before any real-capital capability can be considered.

## Product flow

```text
Mission Control
  → choose a specialist in Agent Room
  → give a bounded research brief
  → inspect evidence, conversation, and scoped memory
  → review a paper proposal or decision record
  → retain an immutable owner activity trail
```

The Supervisor coordinates specialist roles but does not receive wallet, key, signing, or venue authority. A role labelled **execution** is intentionally excluded from individual conversations and memory-context retrieval.

## Shared and private memory

Ledgerline treats memory as visible owner data rather than a hidden chatbot history. A **team-shared** item can be used by eligible research specialists. A **private** item is associated with one selected specialist only. The server derives every context bundle from the authenticated owner, selected agent, active status, expiry, and bounded retrieval limits.

Moving a private note to team memory requires an explicit request and administrator review. While a request is pending, the note remains private. Approval changes the same record to shared, clears its individual agent target, increments its revision, and writes a memory audit action. Rejection restores the active private item. Secret-like text is rejected before persistence, and retrieved memory is labelled as untrusted reference material when supplied to a model.

Read the detailed [memory-promotion workflow](docs/architecture/agent-memory-workspace.md) and the [system overview](docs/architecture/system-overview.md) before extending this behaviour.

## Quick start

Use **Node.js 24.x LTS** and pnpm. Do not commit `.env` files, real credentials, database URLs, wallet material, private keys, seed phrases, or account data.

```bash
git clone https://github.com/FrancKINANI/ai-investment-agent.git
cd ai-investment-agent
pnpm install --frozen-lockfile
pnpm dev
```

Open `/welcome` for the public introduction or `/` for Mission Control. Sign in before expecting owner-scoped agents, conversations, policies, portfolio posture, or activity records.

```bash
pnpm test
pnpm check
pnpm build
pnpm audit --prod
pnpm drizzle-kit check
```

## Database migrations

Schema changes are reviewed through a branch and pull request, then applied **only to the explicitly identified target environment**. Never infer that a managed project database, local database, `staging`, or `main` is the same environment. The additive `0011_agent_memory_workspace` migration creates individual conversation, memory-entry, and memory-action tables; it does not create data and does not alter existing tables.

## Documentation

| Audience | Document | Purpose |
| --- | --- | --- |
| New operators | [Getting started](docs/guides/getting-started.md) | Run the workspace and follow a safe first research loop. |
| Operators | [Operator guide](docs/guides/operator-guide.md) | Use Mission Control, Agent Room, tasks, decisions, and activity. |
| Developers | [System overview](docs/architecture/system-overview.md) | Understand routes, services, data scopes, and server enforcement. |
| Memory reviewers | [Agent memory workspace](docs/architecture/agent-memory-workspace.md) | Review context construction and private-to-shared promotion. |
| Security reviewers | [Security and data boundaries](docs/architecture/security-and-data.md) | Review no-go controls, privacy, error handling, and migration rules. |
| Future-program reviewers | [Future real-mode architecture](docs/architecture/future-real-mode-architecture.md) | Evaluate a future-only unsealing programme. |
| Contributors | [CONTRIBUTING.md](CONTRIBUTING.md) | Follow the repository workflow and safety constraints. |

## Contribution and security

Use the required workflow: `feat/*` or `fix/*` → pull request → `staging` → separate approval before `main`. Required checks must be green before merge. Report vulnerabilities through the process in [SECURITY.md](SECURITY.md).

Contributions must not add fabricated balances, fills, connected accounts, customer reviews, ratings, or execution results. They must not bypass owner isolation, policy checks, secret handling, prompt-boundary controls, or the compiled venue seal.

Ledgerline is MIT licensed. The repository remains private until the owner chooses otherwise.
