# Ledgerline — State of the Project

> Last updated: 2026-08-27

## Current Status

- **Branch:** `staging` (117 commits)
- **Tests:** 56 files, 402/402 passing
- **Paper-only:** ✅ GO
- **Real capital:** Conditional GO (audit findings fixed, venue sealed by default)

---

## What Was Built

### Slice 1 — Config-driven agent team (`3f0a804`)
- 9 specialist agents defined in `config/agents/team.yaml`
- Research model loaded from YAML (no more hardcoded gpt-5-mini)
- Owner pause enforced at research entry point (S1 audit finding fixed)
- CLI: `ledgerline agents list [--layer] [--enabled-only]`

### Slice 2 — Registry bindings enforcement (`4c2e510`)
- `validateCapabilityAccess()` function gates tool calls at runtime
- Specialist delegation blocked if agent lacks required capabilities
- Research entry point blocked if variation agent lacks evidence access
- Capability usage logged with provenance in operator actions

### Slice 3 — Execution backend abstraction (`32b9d5f` + `703116a`)
- `ExecutionBackend` interface: paper, cex, onchain
- `ExecutionOrchestrator`: evaluateProposalApproval + executeApprovedProposal
- Paper backend wraps existing paperExecutor with authority + mandate checks
- CEX and onchain adapters sealed by `liveExecutionBoundary` in current release
- `settleSimulation` routed through orchestrator
- README rewritten: real OS, not simulation product

### Slice 4 — MCP server manager (`bd84fe1`)
- `McpServerManager` class: spawn, tool discovery (JSON-RPC over stdio), lifecycle
- Failure isolation per server
- Sealed against activation in this release (SSRF protection + feature flag)
- CLI: `mcp status`, `mcp start`, `mcp stop`

### Refactor — Simulation cleanup (`be58b16`)
- All UI-facing "simulation-only" strings replaced with "paper-only", "fail-closed", or "owner-governed"

### Security Audit & Remediation (`65cf015` → `b356ece`)
- Full security audit: 10 findings across auth, secrets, registry, rate limiting, MCP, audit trail
- All 10/10 findings fixed
- 21 regression tests added

### v0.2 — Agent team real + approval UX (`beee840` → `01bcf98`)
- Agents use Registry-bound capabilities (fetch real data via Binance ticker, Blockscout)
- Supervisor: observer only (detects stagnation, weak evidence, poor calibration)
- Approval queue UX in CommandCenter
- Paper path hardened: alerts on gate failures, execution failures, authority pause

### v0.3 — First real CEX path (`aa3d950` → `b675b55`)
- `CEXExecutionBackend` uses `liveAdapter` for real Binance orders
- Authority gates: blocked except `approval-required-live` or `limited-live`
- Per-order owner approval required (no autonomy)
- CLI + tRPC endpoint for paper/live switching
- Settings UI for execution backend selection
- 13 integration tests for full research → approve → CEX pipeline

### Security — Venue sealing (`1b3b8d0` → `a15525e`)
- PR #9 merged: venue mutations sealed by `liveExecutionBoundary`
- Sensitive tRPC procedures tested (`sensitiveProcedure.test.ts`)
- MCP sealed boundary tested (`mcpServer.security.test.ts`)
- DB migration 0010 adds idempotency + daily-risk structures

### Test fix (`a83079e`)
- `sailorService.test.ts` — added mocks for `./db` and `./liveExecutionBoundary`
- Was failing because `createMandate` called `createOperatorAction` without mocked DB

---

## Security Findings Fixed (10/10)

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

---

## What Is Enabled vs Disabled

| Feature | Status | Notes |
|---|---|---|
| Research pipeline | ✅ Enabled | Multi-agent, config-driven |
| Paper execution | ✅ Enabled | Default backend |
| Authority state machine | ✅ Enabled | Fail-closed, paused/revoked dominate |
| Capability registry | ✅ Enabled | Enforced at runtime |
| Approval queue UX | ✅ Enabled | CommandCenter |
| Decision Journal | ✅ Enabled | Immutable audit trail |
| Security alerts | ✅ Enabled | On gate failure, execution failure, authority pause |
| CEX live (Binance) | 🔒 Sealed | Backend exists but sealed by `liveExecutionBoundary` |
| On-chain live | 🔒 Sealed | Sailor stub, sealed |
| MCP activation | 🔒 Sealed | Manager exists, feature flag off |
| Real capital | 🔒 Blocked | Authority must be explicitly transitioned |

---

## Architecture Decisions

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
| Venue mutations sealed by boundary | No live orders without explicit code change + authority transition |

---

## What Remains To Do

### High Priority

1. **Strategy Lineage / Evolution Loop** — DB schema exists (`strategyLineages`, `strategyEvaluations`, `outcomeRecords`) but no automatic learning loop. Needs:
   - Scheduled job evaluating recent proposals
   - Lineage tracking (parent → child strategy versions)
   - Evaluator agent scoring outcomes vs expectations
   - Automatic lineage advancement on passing evaluations

2. **Unified agent taxonomy** — Two systems exist:
   - `shared/tradingAgents.ts` (old, hardcoded roles)
   - `shared/agentRuntime.ts` (new, config-driven)
   - Need to deprecate old and migrate to new system

### Medium Priority

3. **Real CEX execution** — Backend stub in `server/backends/cex.backend.ts`. Needs:
   - Real Binance API integration (order placement, status polling)
   - Idempotency + reconciliation with paper backend
   - Authority state gates (only `approval-required-live` or `limited-live`)
   - Owner confirmation ceremony for first live order

4. **Real on-chain execution** — Backend stub in `server/backends/onchain.backend.ts`. Needs:
   - Sailor protocol integration
   - WalletConnect v2 signing flow
   - Non-custodial by design (owner signs, never the server)
   - Gas estimation + slippage protection

5. **MCP real server connection** — Manager built but no real server configured. Needs:
   - Configure a real MCP server
   - Test tool discovery end-to-end
   - Bind discovered tools to agent capabilities
   - Handle server crashes gracefully

### Low Priority

6. **Dashboard improvements** — Settings page for MCP server management, authority state visualization
7. **Research source expansion** — DeFi Llama, CoinGecko, The Graph, news APIs, social sentiment
8. **Testing expansion** — More integration tests for full pipelines, MCP, authority transitions

---

## Suggestions For Future Work (not part of current plan)

- Strategy evolution AI with LLM-suggested variations
- Multi-owner / DAO support with RBAC
- Backtesting engine
- Paper → Live gradual migration (percentage-based allocation)
- Mobile companion app
- Tax reporting
- Plugin system / marketplace
- GPU-accelerated on-chain analysis
- Traditional brokerage integration (IBKR, Alpaca)
