# Operator Guide

Ledgerline is organised around one simple operating loop: see the research desk, direct a specialist, inspect its context and evidence, review a paper decision, and preserve the trail. It is not a trading terminal and does not offer real-capital execution.

## Mission Control

Mission Control is the default view. It shows the authenticated owner’s research desk, recent agent work, current tasks, blocked work, decision attention, investment-policy posture, account/connection posture, and activity trace. Each surface is explicit about unavailable or empty data. Use the agent roster to open a particular specialist in Agent Room.

## Agent Room

Agent Room supports a Supervisor conversation and focused conversations with active research specialists. The selected agent is server-derived, so a thread cannot be replayed against a different role. An execution-oriented role cannot receive individual messages or memory context.

The workspace has three visible areas: the selected agent roster, the focused conversation, and the memory panel. The memory panel separates **team-shared** entries from notes **private to the selected agent**. Use private scope for role-specific working context. Use shared scope only for context suitable for the wider research team.

To move a private note to shared memory, request a promotion. The note becomes pending and remains private. An administrator reviews it and either shares it with the team or keeps it private. Every transition is audit-recorded. Context entries are bounded, expire when configured, and are delivered to models as untrusted reference material.

## Tasks, decisions, portfolio, and activity

**Tasks** is the source of record for current, completed, and blocked agent work. **Decision Desk** is for paper-proposal review; a proposal record does not create venue authority. **Portfolio** provides only the connection and account posture that the server can verify. **Activity** records owner-scoped operational events and security signals.

## Safety state

The sidebar and Mission Control display the active **Simulation · sealed** operating boundary. This is deliberate. The product has no enabled wallet signing, on-chain operation, Binance order path, cancellation path, API-key execution path, or real-capital mode. No chat message, agent note, approval, configuration change, or stored memory can alter that state.

## Escalation and review

When a screen, memory item, or proposal appears inconsistent, do not infer missing data. Check the recorded source and Activity trace, then report the issue through the project’s security process. Do not paste secrets, recovery phrases, private keys, API tokens, or account data into a chat or memory entry.
