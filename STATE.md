# Ledgerline — State of the Project

> Last updated: 2026-08-27

## What Was Built

### Slices Completed (on `staging` branch)

**Slice 1 — Config-driven agent team** (`3f0a804`)
- 9 specialist agents defined in `config/agents/team.yaml`
- Research model loaded from YAML (no more hardcoded gpt-5-mini)
- Owner pause enforced at research entry point (S1 audit finding fixed)
- CLI: `ledgerline agents list [--layer] [--enabled-only]`

**Slice 2 — Registry bindings enforcement** (`4c2e510`)
- `validateCapabilityAccess()` function gates tool calls at runtime
- Specialist delegation blocked if agent lacks required capabilities
- Research entry point blocked if variation agent lacks evidence access
- Capability usage logged with provenance in operator actions

**Slice 3 — Execution backend abstraction** (`32b9d5f` + `703116a`)
- `ExecutionBackend` interface: paper, cex, onchain
- `ExecutionOrchestrator`: evaluateProposalApproval + executeApprovedProposal
- Paper backend wraps existing paperExecutor with authority + mandate checks
- CEX and onchain backends are stubs (Phase 2/3)
- `settleSimulation` routed through orchestrator
- README rewritten: real OS, not simulation product

**Slice 4 — MCP server manager** (`bd84fe1`)
- `McpServerManager` class: spawn, tool discovery (JSON-RPC over stdio), lifecycle
- Failure isolation per server
- Gated behind `featureFlags.mcpActivation`
- CLI: `mcp status`, `mcp start`, `mcp stop`
- Schema supports command/url/env for active servers

**Refactor — Simulation cleanup** (`be58b16`)
- All UI-facing "simulation-only" strings replaced with "paper-only", "fail-closed", or "owner-governed"
- `setMandateMode("real")` now checks authority state + IPS instead of blanket rejection
- 16 files updated across server, client, and docs

### Test Status
- **49/49 test files pass**
- **335/335 tests pass**
- Remaining "simulation-only" references are only in functional enum/type definitions

---

## What Remains To Do

### High Priority

1. **Docs update** — Dozens of markdown files in `docs/` still reference "simulation-only"
   - `docs/guides/getting-started.md`
   - `docs/guides/phase0-configuration-cli.md`
   - `docs/architecture/security-and-data.md`
   - `docs/architecture/future-real-mode-architecture.md`
   - `docs/maintainers/*.md`
   - And more

2. **Strategy Lineage / Evolution Loop** — The DB schema exists (`strategyLineages`, `strategyEvaluations`, `outcomeRecords`) but there's no automatic loop where agents learn from past decisions. Needs:
   - A scheduled job that evaluates recent proposals
   - Lineage tracking (parent → child strategy versions)
   - Evaluator agent that scores outcomes against expectations
   - Automatic lineage advancement on passing evaluations

3. **Unified agent taxonomy** — Two systems exist:
   - `shared/tradingAgents.ts` (old, hardcoded roles)
   - `shared/agentRuntime.ts` (new, config-driven)
   - Need to deprecate the old one and migrate everything to the new system

### Medium Priority

4. **Real CEX execution** — Backend stub exists in `server/backends/cex.backend.ts`. Needs:
   - Real Binance API integration (order placement, status polling)
   - Idempotency + reconciliation with paper backend
   - Authority state gates (only `approval-required-live` or `limited-live`)
   - Owner confirmation ceremony for first live order

5. **Real on-chain execution** — Backend stub in `server/backends/onchain.backend.ts`. Needs:
   - Sailor protocol integration
   - WalletConnect v2 signing flow
   - Non-custodial by design (owner signs, never the server)
   - Gas estimation + slippage protection

6. **MCP real server connection** — Manager is built but no real server is configured. Needs:
   - Configure a real MCP server (e.g., Binance Agent OS)
   - Test tool discovery end-to-end
   - Bind discovered tools to agent capabilities
   - Handle server crashes gracefully

### Low Priority

7. **Dashboard improvements** — Settings page for:
   - MCP server management (start/stop/status per server)
   - Execution backend selection UI
   - Authority state machine visualization

8. **Research source expansion** — Add more data sources:
   - DeFi Llama, CoinGecko, The Graph
   - News APIs (CryptoPanic, Messari)
   - Social sentiment (LunarCrush, Santiment)

9. **Testing expansion** — Integration tests for:
   - Full research → proposal → approve → execute pipeline
   - MCP server tool discovery
   - Authority state transitions
   - Multi-agent debate with real LLM calls

---

## Architecture Decisions Made

| Decision | Rationale |
|---|---|
| Config-driven agents (YAML) | User controls everything without code changes |
| Fail-closed defaults | Authority starts disabled, must be explicitly climbed |
| Capability registry as source of truth | Agents never import tools directly |
| Paper as one backend, not product identity | Same pipeline for paper/CEX/onchain |
| Orchestrator pattern | Separates HTTP routing from execution logic |
| MCP gated behind feature flag | No processes spawn unless explicitly enabled |
| Permission enum keeps "simulation-only" | It's a functional permission level, not branding |

---

## Suggestions For Future Work (ignore these)

These are ideas that came up during development but are NOT part of the current plan:

- **Strategy evolution AI**: Use an LLM to automatically suggest strategy variations based on outcome data. The evaluator agent could generate "child" strategies from "parent" strategies that underperformed.

- **Multi-owner support**: Currently Ledgerline is single-owner. Could add team/DAO support with role-based access control.

- **Backtesting engine**: Run historical data through the agent pipeline to validate strategies before deploying capital.

- **Paper → Live gradual migration**: Instead of binary paper/live, allow percentage-based allocation (e.g., 10% live, 90% paper) that gradually shifts.

- **Mobile companion app**: Monitor proposals, approve/reject, and receive alerts on mobile.

- **Tax reporting**: Automatic cost-basis tracking and tax-loss harvesting suggestions.

- **Social features**: Share anonymized research findings with a community of Ledgerline users.

- **Plugin system**: Allow third parties to create and distribute agent plugins via a marketplace.

- **GPU-accelerated on-chain analysis**: Run YOLO/CV models on-chain data (NFT analytics, DeFi position visualization).

- **Integration with traditional brokerages**: IBKR, Alpaca, etc. via their APIs.
