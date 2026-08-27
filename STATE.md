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

**Security Audit & Remediation** (`65cf015` + `e842231`)
- Full security audit: 10 findings across auth, secrets, registry, rate limiting, MCP, audit trail
- All HIGH and MEDIUM findings fixed (LL-SEC-001 through LL-SEC-005)
- 21 regression tests added for security fixes
- Verdict: GO for paper-only, GO conditionnel for real capital

### Security Findings Fixed (all 10/10)

| ID | Severity | Finding | Fix | Commit |
|---|---|---|---|---|
| LL-SEC-001 | HIGH | Rate limiter not wired into tRPC | `rateLimitMiddleware` on protected/admin | `e842231` |
| LL-SEC-002 | HIGH | KMS dev fallback key predictable | Block unless dev + opt-in | `e842231` |
| LL-SEC-003 | MEDIUM | Config overlay bypasses binding approval | Overlay = research/simulation only | `e842231` |
| LL-SEC-004 | MEDIUM | MCP HTTP has no SSRF protection | `isSafeMcpUrl()` blocks private IPs | `e842231` |
| LL-SEC-005 | MEDIUM | `createAgentRun` hardcodes simulationOnly | Parameterized (default true) | `e842231` |
| LL-SEC-006 | LOW | Rate limiter no cleanup | 5min `setInterval` cleanup | `b356ece` |
| LL-SEC-007 | LOW | Auth logs leak timing | Sanitized `console.warn` | `b356ece` |
| LL-SEC-008 | LOW | Admin role not revalidated | `requireAdminFresh` DB re-fetch | `b356ece` |
| LL-SEC-009 | LOW | Cron depends on external OAuth | 503 retryable on network error | `b356ece` |
| LL-SEC-010 | INFO | Permissions-Policy header missing | Added to tRPC middleware | `b356ece` |

### Remaining Risks (documented, not blocking)

- Rate limiter is in-memory (not Redis) — adequate for single-server
- KMS uses env var (not cloud KMS) — adequate for single-server
- MCP SSRF protection doesn't cover DNS rebinding

### Test Status
- **53/53 test files pass**
- **384/384 tests pass**
- **21 security regression tests** across 4 test files
- Remaining "simulation-only" references are only in functional enum/type definitions

### Git Status
- **19 commits** on `staging` since work began (all pushed to `origin/staging`)
- **107 total** commits on `staging`
- `main` is at `4b2fd83` (unchanged)

---

**v0.3 — First real CEX path (Binance only)** (latest)
- `CEXExecutionBackend` uses `liveAdapter` for real Binance order submission
- Authority state machine gate: only `approval-required-live` or `limited-live`
- Mandate validation: mode, status, venue, asset allowance, order limits
- Per-order owner approval in `approval-required-live` state
- Pre-trade price freshness for market orders
- Idempotency via proposalId (server-generated)
- Full ledger lifecycle: submitted → filled/rejected
- Alerts on fill/reject
- Config: `setActive("cex")` to switch from paper to live
- **Default: paper** — live requires explicit owner action
- 16 new tests (authority gates, credentials, mandate checks, happy path)

---

## What Remains To Do

### High Priority

1. **Strategy Lineage / Evolution Loop** — The DB schema exists (`strategyLineages`, `strategyEvaluations`, `outcomeRecords`) but there's no automatic loop where agents learn from past decisions. Needs:
   - A scheduled job that evaluates recent proposals
   - Lineage tracking (parent → child strategy versions)
   - Evaluator agent that scores outcomes against expectations
   - Automatic lineage advancement on passing evaluations

2. **Unified agent taxonomy** — Two systems exist:
   - `shared/tradingAgents.ts` (old, hardcoded roles)
   - `shared/agentRuntime.ts` (new, config-driven)
   - Need to deprecate the old one and migrate everything to the new system

### Medium Priority

3. **Real CEX execution** — Backend stub exists in `server/backends/cex.backend.ts`. Needs:
   - Real Binance API integration (order placement, status polling)
   - Idempotency + reconciliation with paper backend
   - Authority state gates (only `approval-required-live` or `limited-live`)
   - Owner confirmation ceremony for first live order

4. **Real on-chain execution** — Backend stub in `server/backends/onchain.backend.ts`. Needs:
   - Sailor protocol integration
   - WalletConnect v2 signing flow
   - Non-custodial by design (owner signs, never the server)
   - Gas estimation + slippage protection

5. **MCP real server connection** — Manager is built but no real server is configured. Needs:
   - Configure a real MCP server (e.g., Binance Agent OS)
   - Test tool discovery end-to-end
   - Bind discovered tools to agent capabilities
   - Handle server crashes gracefully

### Low Priority

6. **Dashboard improvements** — Settings page for:
   - MCP server management (start/stop/status per server)
   - Execution backend selection UI
   - Authority state machine visualization

7. **Research source expansion** — Add more data sources:
   - DeFi Llama, CoinGecko, The Graph
   - News APIs (CryptoPanic, Messari)
   - Social sentiment (LunarCrush, Santiment)

8. **Testing expansion** — Integration tests for:
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
| Rate limiting on all protected endpoints | Prevents brute-force on approvals, credentials, authority |
| KMS dev fallback requires explicit opt-in | Prevents credential encryption with known key |
| Overlay cannot grant execution permissions | Staged workflow required for dangerous bindings |
| SSRF protection on MCP HTTP URLs | Prevents internal network probing |

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
