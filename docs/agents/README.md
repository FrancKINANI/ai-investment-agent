# Agent Utility Library

This directory holds the user-supplied guidance for the Personal AI Investment Agent. The files are **reference and design inputs**, not executable permissions. Ledgerline’s deterministic IPS, simulation boundary, owner controls, and execution-readiness gate remain authoritative where a utility document describes a future live-capability path.

## Contents

| Document | Purpose |
| --- | --- |
| [System prompt](system-prompt.md) | Safety-first Level-2 autonomy, owner control, auditability, and progressive-autonomy principles. |
| [Orchestration guide](orchestration-guide.md) | Layer separation, inter-agent communication, Risk veto, Decision synthesis, and escalation patterns. |
| [Regime Agent](roles/regime-agent.md) | Market-regime context guidance. |
| [Variation Agent](roles/variation-agent.md) | Bounded strategy-variation and lineage guidance. |
| [Evaluator Agent](roles/evaluator-agent.md) | Hard-gate and multi-objective evaluation guidance. |
| [Risk Agent](roles/risk-agent.md) | Independent risk controls and veto responsibilities. |
| [Decision Agent](roles/decision-agent.md) | Policy-bound decision record and proposal synthesis guidance. |
| [Supervisor Agent](roles/supervisor-agent.md) | Long-horizon trajectory observation and recommendation guidance. |

## Runtime mapping

The current workspace implements protected agent nodes, owner-selectable provider/model routes, persisted messages and evolution records, audit logging, IPS-aware watchlists, and a simulation-only proposal lifecycle. It does **not** turn these Markdown prompts into unrestricted autonomous code, wallet authority, key custody, or a live venue connection.

> The Risk role’s veto and the owner’s emergency control remain hard boundaries; they cannot be overridden by a prompt, a model selection, or an optional subagent.
