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
