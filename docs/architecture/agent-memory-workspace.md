# Agent Memory Workspace

The Agent Memory Workspace gives an owner a comprehensible way to see what context a specialist may use without turning memory into an invisible global prompt. It supports two scopes: **shared team memory** and **private specialist memory**. It does not store or expose chain secrets, platform credentials, wallet material, signing requests, execution authority, or hidden reasoning traces.

## Context contract

An individual conversation is server-bound to a selected, active, non-execution agent. The server verifies ownership of the agent and of any supplied thread ID. It then constructs context in a fixed order: compact policy context, pinned shared entries, recent shared entries, active private entries for that exact agent, and a small recent thread history. The selection excludes expired, redacted, superseded, and pending-promotion memory.

| Scope | Intended content | Who can use it |
| --- | --- | --- |
| `shared` | Owner-approved constraints, verified facts, evidence references, or team decisions. | Eligible research agents for the same owner. |
| `private` | Specialist working notes, focused questions, or role-specific research constraints. | The selected specialist and the owner only. |

All memory content is bounded, labelled as **untrusted reference material** in the model-facing prompt, and screened before storage for common secret-like patterns. The screen is a defence-in-depth control, not a replacement for never entering credentials or wallet material.

## Promotion workflow

1. The owner writes a private note for a selected specialist. The server validates the selected active research role, memory scope, content safety, and owner ownership.
2. The note is usable only in that specialist’s focused conversations while it is `active` and unexpired.
3. The owner requests a promotion. The note changes to `pending_promotion` but remains `private`; it is excluded from all model contexts during review.
4. An administrator approves or rejects the request. Approval changes the existing entry to `shared`, clears its agent target, restores `active`, increments its revision, and writes an audit action. Rejection restores its private active state, retains its agent target, increments the revision, and writes a rejection action.

No agent can silently promote a note. Neither a promotion request nor approval modifies the Investment Policy Statement, role capabilities, stored credentials, wallet sessions, mandates, or the real-capital execution boundary.

## Database migration and environment handling

The `0011_agent_memory_workspace` migration is additive. It creates `agentIndividualConversations`, `agentMemoryEntries`, and `agentMemoryActions`; it does not modify existing tables and does not insert records. Its deployment target must be named explicitly before execution. The migration must never be applied merely because a local branch exists or because a project preview is running.

For the current staging rollout, the tables were created only after the owner explicitly designated the managed database as the staging target. They were verified empty after creation. Future work should use a dedicated staging database rather than reusing that target implicitly.
