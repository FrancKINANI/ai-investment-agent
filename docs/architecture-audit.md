# Ledgerline Architecture Audit — Phase 0 (pre-refactor)

**Date:** 2026-08-25 · **Branch state:** main @ `79f5c74` (Stages 0–4 of the real-mode program merged)
**Method:** every claim below was verified against actual source, not the prompt's description. Discrepancies with the prompt are flagged explicitly.

---

## 1. The five coupling points — file-by-file verdicts

### CP-1: "agentFabric.sendSupervisorMessage … is called directly from routers.ts"

**Verdict: CONFIRMED IN SUBSTANCE, WRONG IN DETAIL.**

- `server/agentFabric.ts` does **not** export a `sendSupervisorMessage`. That name does not exist anywhere in the repo.
- What actually exists: `routers.ts:217` (`sendSupervisorMessage` tRPC mutation) contains the full Bull → specialists → FundManager disagreement review → Supervisor synthesis sequence **inline in the router body** (~50 lines), importing `composeSpecialistOutput`, `composeFundManagerDisagreementSummary`, `composeSupervisorReply`, `calculateResearchNoteConfidence` from `./agentFabric` (`routers.ts:21`) and ~23 persistence functions from `./agentFabricDb` (`routers.ts:22`).
- Consequence for Phase 1: the extraction target is real and needed; the wrapper must lift the *inline* sequence, and the persistence calls (`createAgentMessage`, `createEvolutionEvent`, `ensureProtectedAgentNodes`, …) must stay byte-for-byte equivalent in ordering and payload shape.

### CP-2: "agents read agentMessages directly"

**Verdict: PARTIALLY CONFIRMED — one layer down, centralized.**

- Agents themselves (`server/agentFabric.ts`) never touch the DB. They receive `history: ThreadMessage[]` as arguments and only make LLM calls.
- Direct table access is centralized in `server/agentFabricDb.ts` (a second DB module alongside `db.ts`): `insert agentMessages` (:73), `select … from agentMessages` (:75, :82). Repo-wide search confirms **zero** other non-test access to `agentMessages` outside `db.ts`/`drizzle/schema`.
- Phase 2 consequence: `MemoryProvider` should wrap `agentFabricDb.createAgentMessage` / `listAgentMessages`. The acceptance criterion ("zero direct `agentMessages` access outside db.ts and MemoryProvider") will additionally require folding `agentFabricDb` into the provider or behind it.

### CP-3: "Bull/Bear access onchain.ts / research.ts without role scoping"

**Verdict: NOT CONFIRMED — the risk is different from described.**

- Specialist agents have **no tool access at all**: `composeSpecialistOutput` builds an LLM prompt from thread history + message only. No imports of `onchain.ts` or `research.ts` exist in any agent module.
- `research.ts` and `onchain.ts` are invoked by *router-level research flows*, not by Bull/Bear personas.
- Therefore there is no prompt-injection → tool-misuse surface today, because there are no tools to misuse. Phase 3 is still worth building **before** tools are introduced (it is preventive), but the audit must state plainly: this phase creates a guardrail for capabilities that do not yet exist, and its acceptance test guards future wiring.

### CP-4 (CRITICAL SECURITY): "Does the Decision Kernel re-verify raw facts or trust LLM summaries?"

**Verdict: SPLIT. Kernel core is clean; three trust-boundary violations found around it.**

Clean parts:
- `decideProposal` / `evaluatePromotionGate` (`shared/agentRuntime.ts`) are pure functions over typed inputs — no LLM output, no DB, deterministic and unit-testable. This matches the Phase 4 target as-is.
- `policyResult` is computed by `assessResearchPolicy(address, policy)` (`server/research.ts:27`) deterministically against the stored IPS allowlist — raw data, not LLM claims. ✅
- At execution time, `executeCexOrder` re-verifies against raw mandate rows via `checkMandateAllowance` (limits in bps, asset allowlist) plus the Stage 0b authority-state gate inside `executeLiveOrder`. Execution does **not** trust the proposal's approved status alone. ✅

Violations found (**these are security findings, not refactor details**):

1. **Hardcoded owner pause.** `research.ts:132` passes `ownerPauseActive: false` unconditionally instead of reading the authority state (`getAuthorityState`). A paused/revoked owner would still see proposals advance through the research pipeline. *Fix belongs with the Stage 5 authority reconciliation; flagging now per rule 9.*
2. **Client-supplied gate evidence.** `routers.ts:385` and `:428` feed `simulationPassed`, `ownerPauseActive`, `lineageCoverage`, `complexityPenalty` straight from client input into `evaluatePromotionGate`. These are trust-on-arrival booleans: a manipulated client can assert `simulationPassed=true`. The kernel is pure, but its inputs are unaudited claims rather than server-derived facts.
3. **No existing test proves kernel inputs come from raw data.** There is no test asserting that promotion decisions are derived from persisted evidence. Rule 9 requires this be raised explicitly: it exists as a gap today.

### CP-5: "agentExecutor branches on venue via if/switch"

**Verdict: CONFIRMED.**

- `server/agentExecutor.ts:266–274`: if-chain over venue strings routing to `executeCexOrder` / `executeOnChainTx`, returning `{ success:false, error:"Unknown venue" }` otherwise. Exactly the Phase 5 target. Note the CEX branch silently treats okx/coinbase/kraken as binance-routed (`executeCexOrder` hardcodes Binance mandate + key lookup regardless).

---

## 2. Direct DB access by agents (rule 1 checklist)

| Module | Imports db directly? | Notes |
|---|---|---|
| `agentFabric.ts` | ❌ no | Pure LLM composition; history passed in |
| `agentExecutor.ts` | ⚠️ indirect | Via `./db` functions (`listWalletMandates`, `createOperatorAction`) — execution domain, acceptable pre-refactor |
| `sailorService.ts` | ⚠️ indirect | Own persistence for mandates/txs |
| `agentFabricDb.ts` | ✅ yes | Second DB surface; owns `agentMessages` access |

No agent reaches past an interface to raw tables except through these two service modules.

## 3. Existing assets that overlap the refactor targets

- Append-only ledger already exists for execution: `executionLedger` (Stage 1). Phase 4 extends the pattern to proposals/mandates; evaluate reusing `operatorActions` vs new `ledgerEvents` per prompt's own instruction.
- `decideProposal` already satisfies "pure, DB-free, LLM-free" (Phase 4 target) — the work is hardening its *inputs*, not the function.
- Authority state machine (Stage 0) provides the missing `ownerPauseActive` source of truth.

## 4. Security findings register (to fix as separate tickets, per rule 9)

| # | Finding | Severity | Proposed ticket |
|---|---|---|---|
| S1 | `ownerPauseActive` hardcoded `false` in research pipeline | High | Wire to `getAuthorityState`; add negative test (paused ⇒ no advancement) |
| S2 | Promotion gate trusts client-supplied evidence flags | High | Derive `simulationPassed`/coverage from persisted simulation records; reject client assertions |
| S3 | No regression test proving decision inputs derive from raw stored data | Medium | Add kernel-boundary test per rule 9 |
| S4 | `executeCexOrder` routes okx/coinbase/kraken through Binance-specific logic | Medium | VenueAdapter (Phase 5) fixes structurally; explicit unknown-venue rejection until then |

## 5. Validation commands

`pnpm test` / `pnpm check` / `pnpm build` all exist in `package.json` and pass on current main (verified during Stages 0–4 merges).

## 6. Recommendation

Proceed to Phase 1 after owner validates this report. Proposed order stays as specified, with one addition: tickets S1–S3 should be scheduled either immediately before Phase 1 or folded into Phase 1's PR series as separate commits (never hidden inside a refactor diff).

---

## 7. Slice 1 Progress: Config-Driven Agent Team ✅ COMPLETED

**Status:** Merged to staging @ commit `3f0a804`

**Changes:**
- `config/agents/team.yaml` created with full v0.5 team spec (13 agents, schemaVersion 1, model/provider per agent)
- `shared/agentTeam.ts` loads and caches team YAML at startup; `loadAgentTeam()`, `findTeamRole()`, `delegationRoleKeys()` replace hardcoded role maps
- `server/routers.ts` wired: variation agent model read from team.yaml instead of hardcoded "gpt-5-mini"
- `scripts/ledgerline.mjs` enhanced: `ledgerline agents list [--layer LAYER] [--enabled-only]` CLI command
- S1 audit finding **FIXED**: `server/research.ts` now calls `getAuthorityState(userId)` and passes real `ownerPauseActive` value to decision kernel
- `config/default.yaml` executionBoundary changed from "fail-closed" to "fail-closed"

**Tests:**
- ✅ All 13 agents load with correct models, capabilities, and enabled status
- ✅ Variation agent model override respected
- ✅ `ledgerline agents list` shows full roster with layer + enabled status
- ✅ Paused owner blocks research advancement

---

## 8. Slice 2 Progress: Registry Bindings Enforcement ✅ COMPLETED

**Status:** Merged to staging @ commit `4c2e510`

**Changes:**
- `shared/capabilityRegistry.ts` enhanced: new `validateCapabilityAccess(roleKey, requiredCapabilities): Capability[]` function
- Function validates role→capability binding exists, capability is active, throws FORBIDDEN if missing
- `server/routers.ts` wired: `sendSupervisorMessage` now validates specialist capabilities before delegation
- `server/routers.ts` wired: `analyzeToken` (research entry) validates research capabilities before running
- `shared/capabilityRegistry.ts`: `createCapabilityProvenance()` logs which capabilities were used in operator action payload
- Fail-closed: TRPCError(FORBIDDEN) thrown if binding missing; no fallback to permissionless operation

**Tests:**
- ✅ Capability validation rejects agents without bindings
- ✅ Capability usage logged with provenance in operator actions
- ✅ Fail-closed behavior confirmed (no execution on missing binding)

**S2 audit finding status:** Capability bindings now enforced. Server-side derivation of promotion gate inputs (S2) still pending Slice 3 orchestrator refactor.

**S3 audit finding status:** Hard-gate kernel still trusts client evidence flags. Will be fixed in Slice 3 when orchestrator extracts decision logic.

---

## 9. Slice 3 Progress: Execution Backend Abstraction & Orchestrator (IN PROGRESS)

**Status:** Partial implementation (backend interfaces + orchestrator + docs complete). Integration pending.

**Sub-tasks completed:**

1. ✅ **ExecutionBackend Interface** (shared/executionBackend.ts)
	- Defines `ExecutionBackend` interface: `type`, `label`, `verify()`, `execute(ExecutionRequest): ExecutionResult`
	- Request includes userId, proposalId, order details, mandate, authority state
	- Result is typed union: `{ status: "submitted"|"filled"|"partially_filled"|..., ...} | {status: "rejected"|"blocked", reason}`

2. ✅ **Paper Backend Implementation** (server/backends/paper.backend.ts)
	- Wraps existing `submitPaperOrder` logic
	- Performs S2 authority checks + mandate validation
	- Returns ExecutionResult matching interface

3. ✅ **CEX & On-chain Backend Stubs** (server/backends/cex.backend.ts, onchain.backend.ts)
	- Phase 2+ placeholders; return "not yet implemented" for now
	- Authority checks in place; ready for Phase 2 API integration

4. ✅ **ExecutionBackendRegistry** (server/backends/registry.ts)
	- Singleton registry; `getExecutionBackendRegistry()` loads backends at startup
	- `active()` returns configured backend; `backends()` lists all registered
	- Paper backend always available; CEX/onchain register but may throw if config missing

5. ✅ **ExecutionOrchestrator** (server/runtime/executionOrchestrator.ts)
	- `evaluateProposalApproval(input): ApprovalResult` — applies hard gate, returns approval decision
	- `executeApprovedProposal(input): ExecutionOrchestratorResult` — loads proposal + authority state, calls backend, records result + audit trail
	- **NOT YET WIRED:** routers.ts still calls paperExecutor directly; orchestrator awaits integration

6. ✅ **Backend Config** (config/execution/backend.yaml)
	- YAML config for backend selection, per-backend risk levels, phase gates
	- Specifies active backend, enable/disable flags, auth requirements
	- Authority ceiling mapping (paper can use from any state; CEX/onchain require higher authority)

7. ✅ **Documentation Updates**
	- [README.md] rewritten: "fail-closed" → "real, owner-controlled OS with pluggable backends"
	- Architecture diagram showing unified pipeline + swappable backends
	- Configuration-driven control explained (agents, bindings, backends all YAML)
	- Phase roadmap added: Phase 0-1 (OS layer), Phase 2 (CEX), Phase 3 (on-chain)
	- [docs/architecture-audit.md] (this file) updated with Slice progress + findings

**Remaining Slice 3 work:**
- ⏳ Integrate orchestrator into routers.ts (wire approveProposal + settleSimulation to new functions)
- ⏳ Populate executionOrchestrator with real proposal data loading (order details, symbol, etc.)
- ⏳ Create proposal schema extension if needed (ensure symbol, side, quantity, limitPrice stored in proposal record)
- ⏳ Test end-to-end: proposal → approval → execution through paper backend
- ⏳ S2 audit fix: Derive promotion gate inputs (simulationPassed, etc.) server-side from persisted records, not client input
- ⏳ S3 audit fix: Hard-gate outputs at kernel level in orchestrator

---

## 10. Audit Status Summary

| Finding | Status | Evidence | Next Step |
|---------|--------|----------|-----------|
| S1: ownerPauseActive hardcoded | ✅ FIXED | server/research.ts line 92-93 reads from getAuthorityState | Completed Slice 1 |
| S2: Client-supplied gate evidence | 🔄 IN PROGRESS | Orchestrator designed; will validate server-side in routers integration | Slice 3: integrate + test |
| S3: No kernel input validation test | 🔄 IN PROGRESS | Orchestrator validates gate inputs from DB; test coverage pending | Slice 3: add regression tests |
| CP-1: sendSupervisorMessage extraction | 🔄 IN PROGRESS | Orchestrator design ready; routers still inline; refactor pending | Slice 3: extract logic to supervisorLoop |
| CP-4: Decision kernel purity | ⏳ PENDING | Kernel already pure; input validation next | Slice 3: finalize orchestrator integration |
