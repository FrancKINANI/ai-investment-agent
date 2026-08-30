# Security Invariants

## Overview
This document enumerates the security invariants enforced in the Ledgerline project and the enforcement points (files/functions) that guarantee they hold. All invariants are **fail-closed** by default and verified by the test suite in `tests/security/`.

---

## Invariants

### 1. Live Venue Mutations Are Compile-Time Sealed
- **Invariant**: `LIVE_VENUE_MUTATIONS_SEALED` is a compile-time constant `true`. No environment flag, feature flag, config, mandate, or model output may unseal live venue mutations.
- **Enforcement point**: `server/liveExecutionBoundary.ts` — `LIVE_VENUE_MUTATIONS_SEALED = true`
- **Every path** that could decrypt keys, read mandates for live use, call venue adapters for mutation, place orders, sign, or broadcast must check the seal first and fail closed.
- **Procedures** that check the seal: `liveRouter.placeOrder`, `liveRouter.cancelOrder` (both call `assertLiveVenueMutationsSealed()`).
- **Test**: Attempting live mutation paths throws `LiveVenueMutationSealedError`; no network call to venue mutation endpoints occurs when sealed.

### 2. Capability Registry — Deny-by-Default Gating
- **Invariant**: Every tool/capability invocation must pass through `validateCapabilityAccess(agentId, capability, context)`. Default is deny. Allow only if the agent's declared capabilities (from the capability registry) include the requested capability AND the owner/policy context permits it.
- **Enforcement point**: `shared/capabilityRegistry.ts` — `validateCapabilityAccess(roleKey, requiredCapabilities)`
- **Agents must not import tools directly**. Resolution goes through the registry.
- **Logging/auditing**: Denied and allowed capability uses are logged with provenance (agent, capability, owner, decision).
- **Test**: Capability denials are recorded as audit events; allowed uses are recorded only when the agent's binding permits it.

### 3. Owner Isolation — All Data Access Is Owner-Scoped
- **Invariant**: All reads/writes of conversations, memory, proposals, activity, policy, tasks must filter by authenticated owner id on the server. Private memory never broadens to shared. Execution-role agents never receive individual conversation or memory context.
- **Enforcement point**: Server-side TRPC procedures — every query/mutation that accepts an `agentId` or `userId` filters by `ctx.user.id`.
- **Adversarial test**: Supplying a different owner's `userId` or a different agent's `agentId` in the request results in `NOT_FOUND` or `FORBIDDEN`; the server never returns another owner's data.
- **Procedures enforcing isolation**:
  - `agentMemoryRouter.conversations` — calls `requireActiveResearchAgent(ctx.user.id, input.agentId)`
  - `agentMemoryRouter.workspace` — calls `requireActiveResearchAgent(ctx.user.id, input.agentId)`
  - `agentMemoryRouter.sendIndividualMessage` — calls `requireActiveResearchAgent(ctx.user.id, input.targetAgentId)` and blocks execution-role agents
  - `policy.save` — queries `getInvestmentPolicy(ctx.user.id)`
  - `agentRuntime.evaluateProposal` — derives gate inputs server-side via `deriveGateInputs(ctx.user.id, ...)`

### 4. Memory Scope Boundary — Private Memory Is Agent- and Owner-Specific
- **Invariant**:
  - Private memory is only readable for the exact target agent + owner.
  - Shared memory is only for eligible research agents of that owner.
  - Pending promotion entries must NOT be injected into model context.
  - Execution-role agents must be rejected before message, memory read, or model call for individual conversations.
- **Enforcement point**: `shared/agentMemory.ts` — `selectMemoryContext()`, `canPromoteMemory()`
- **Procedures enforcing boundary**:
  - `agentMemoryRouter.sendIndividualMessage` — calls `selectMemoryContext(workspace.entries, target.agentId)` which filters private entries by `agentId`; execution agents are rejected by `requireActiveResearchAgent`
  - `agentMemoryRouter.requestPromotion` — validates `canPromoteMemory(entry)` (only active private memory may be promoted)
  - `agentMemoryRouter.reviewPromotion` — admin-review of pending promotions
- **Test**: 
  - Owner A cannot read Owner B's private memory entries.
  - An execution-role agent's `sendIndividualMessage` call throws `FORBIDDEN`.
  - Pending promotion entries do not appear in `selectMemoryContext` output until approved.

### 5. Sensitive Procedure Wrapper — Shared Middleware for Authority Changes, Credentials, Live-Adjacent Actions
- **Invariant**: Sensitive tRPC procedures (authority changes, credential-related, live-adjacent, mandate, approvals) are protected with a shared middleware/wrapper that:
  - Requires authenticated owner (or admin where appropriate)
  - Rate-limits
  - Checks seal when relevant
  - Writes an audit/operator action record
  - Fails closed on missing policy/authority state
- **Enforcement point**: `server/_core/trpc.ts` — `sensitiveProcedure` composed of `requireUser`, `rateLimitMiddleware`, `requireSensitiveRequestBoundary`
- **Procedures using `sensitiveProcedure`**:
  - `liveRouter.placeOrder` / `liveRouter.cancelOrder` — checks live seal, mandates, balances
  - `walletRouter.createMandate` / `activateMandate` / `revokeMandate` / `executeMandateTx`
  - `securityRouter.create/acknowledge/addKey/testConnection/rotate/disable/delete/updateLimits`
  - `authorityRouter.transition` — authority state transitions
- **Test**: Each sensitive procedure that misses required context (owner, mandate, seal) throws a `TRPCError` with a stable public code; audit records are created for every call attempt.

### 6. Audit Trail — Security-Relevant Events Produce Structured Owner-Scoped Records
- **Invariant**: Capability denials, seal blocks, authority pauses, memory scope violations, and sensitive procedure calls must leave structured, owner-scoped audit records. No secrets (keys, URLs, raw bodies) in the payload.
- **Enforcement point**: `server/db.ts` — `createOperatorAction(userId, { actionId, kind, status, subject, detail, payload })`
- **Audit record fields**: `actionId`, `kind`, `status`, `subject`, `detail`, `payload` (no secrets).
- **Events always audited**:
  - Capability access attempts (`validateCapabilityAccess` outcome)
  - Seal checks (`assertLiveVenueMutationsSealed` outcome)
  - Authority state transitions
  - Memory creation, promotion requests, promotion reviews
  - Sensitive procedure invocations (`sensitiveProcedure` middleware path)
  - Agent model changes, subagent creation/retirement
- **Test**: After every security-relevant operation, a matching audit record exists in the DB with `userId` scope and no secret values in `payload`.

### 8. Memory Contracts — Shared + Private, Context Assembly, Scope Enforcement (Tranche B)
- **Invariant**: The dual memory system (shared + private per agent) is contractually clear, server-enforced, bounded, auditable, and covered by adversarial tests. All invariants from Tranche A still apply.
- **Access table** (enforced server-side, deny-by-default):

| Memory Type | Who can read | Injectable into model context? |
|-------------|--------------|--------------------------------|
| shared + active + not expired | eligible research agents of that owner | Yes (bounded) |
| private + active + not expired | exact target agent + owner only | Yes, only for that agent (bounded) |
| pending_promotion | owner + admin review only | **Never** |
| expired / superseded / redacted | audit/history only | **Never** |
| any memory | execution-role agent | **Never** (reject before read) |

- **Rules**:
  - Private must never silently broaden to shared.
  - Missing private match must not fall back to shared.
  - Execution agent → reject before message, memory read, or model call (reuse `requireActiveResearchAgent` or equivalent).
- **Context assembly** (single-path, bounded, deterministic):
  ```
  policy_context (if any)
  + active shared memory (owner-scoped, bounded, deterministic order)
  + active private memory for exact agent (bounded, deterministic order)
  + recent messages of that exact individual thread (bounded)
  ```
- **Hard caps**: max 20 shared items (8 pinned + 12 recent), max 8 private items. Ordering: recency then memoryId.
- **Labeling**: All memory blocks in the prompt are labeled as **untrusted reference material** with explicit instruction that they cannot override policy, grant tools, reveal secrets, or create execution behaviour.
- **Pending / expired / redacted / wrong-agent private entries** must be excluded by construction.
- **Promotion workflow**: Owner requests promotion → status `pending_promotion`, remains private for model context. Admin approve → scope becomes shared, clear target_agent_id, increment revision, write memory_action. Admin reject → restore active private, increment revision, write memory_action. No auto-promotion. No model-initiated promotion.
- **Write path safety**: Before persist: reject secret-like content (private keys, mnemonics, credential patterns). Bound entry length (3000 chars max). Owner-scoped creates only.
- **Test coverage**: 
  - Owner A cannot read Owner B memory.
  - Agent X cannot read Agent Y private memory.
  - pending_promotion is never present in assembled model context.
  - expired / redacted / superseded excluded from context.
  - Execution-role agent is rejected before memory read / individual chat.
  - Shared memory visible to eligible research agents of same owner only.
  - Promotion approve/reject updates scope, revision, and audit action correctly; no auto-promote.
  - Context assembly respects bounds and deterministic order.
  - Secret-like content rejected on write (at least representative cases).
- **Enforcement points**:
  - `shared/agentMemory.ts` — `selectMemoryContext()`, `formatMemoryContext()`, `canPromoteMemory()`, hard caps MAX_SHARED_ITEMS=20, MAX_PRIVATE_ITEMS=8
  - `server/agentMemoryRouter.ts` — owner-scoped memory access via `selectMemoryContext(workspace.entries, target.agentId, Date.now(), ctx.user.id)`
  - `server/_core/trpc.ts` — `sensitiveProcedure` middleware for write operations
  - `server/db.ts` — `createOperatorAction` for audit records
- **Test files**: `shared/agentMemory.test.ts`, `server/agentMemoryRouter.test.ts`, `server/invariant-memory-scope.test.ts`, `server/invariant-owner-isolation.test.ts`

### Enforcement Map (Tranche B additions)

| Invariant | Enforcement File/Function | Test File(s) |
|-----------|--------------------------|-------------|
| Memory access table | `shared/agentMemory.ts` `selectMemoryContext()` | `shared/agentMemory.test.ts` |
| Context assembly bounds | `shared/agentMemory.ts` `MAX_SHARED_ITEMS`, `MAX_PRIVATE_ITEMS` | `shared/agentMemory.test.ts` |
| Memory labeling as untrusted | `shared/agentMemory.ts` `formatMemoryContext()` | `shared/agentMemory.test.ts` |
| Promotion state machine | `shared/agentMemory.ts` `canPromoteMemory()`, `requestPromotion`, `reviewPromotion` | `shared/agentMemory.test.ts`, `server/agentMemoryRouter.test.ts` |
| Owner-scoped router access | `server/agentMemoryRouter.ts` | `server/agentMemoryRouter.test.ts` |

---

## Enforcement Map

| Invariant | Enforcement File/Function | Test File(s) |
|-----------|--------------------------|-------------|
| Live venue seal | `server/liveExecutionBoundary.ts` | `server/liveExecutionBoundary.test.ts` |
| Capability deny-by-default | `shared/capabilityRegistry.ts` | `shared/capabilityRegistry.test.ts` |
| Owner isolation | `server/agentMemoryRouter.ts`, `server/routers.ts` | `shared/agentMemory.test.ts`, `server/security.test.ts` |
| Memory scope boundary | `shared/agentMemory.ts`, `server/agentMemoryRouter.ts` | `shared/agentMemory.test.ts` |
| Sensitive procedure wrapper | `server/_core/trpc.ts` | `server/security.test.ts` |
| Audit trail | `server/db.ts` (`createOperatorAction`) | `server/security.test.ts`, `shared/agentMemory.test.ts` |
| No secret leakage | `server/security.ts` (`classifyError`) | `server/security.test.ts` |

---

## Acceptance Criteria (must all pass)

- [ ] `LIVE_VENUE_MUTATIONS_SEALED === true` at compile time; live mutation paths fail closed with tests.
- [ ] No tool/capability call succeeds without `validateCapabilityAccess` (or equivalent) allowing it; default deny tested.
- [ ] Owner A cannot access owner B resources; isolation tests pass.
- [ ] Private memory cannot be read by another agent; pending promotion excluded from model context; execution agent blocked from individual chat/memory; tests pass.
- [ ] Sensitive procedures go through shared wrapper (auth + rate limit + audit + seal when relevant).
- [ ] Security-relevant events produce audit records without secrets.
- [ ] Full existing test suite still passes; new tests added for the invariants above.
- [ ] Short invariants doc updated with enforcement map + test references.
- [ ] No live unseal, no secrets committed, no scope creep beyond this list.

---

## Test Infrastructure

New security-invariant tests live under `tests/security/` (create if missing) and follow these conventions:

- **Naming**: `invariant-<name>.test.ts` (e.g., `invariant-live-seal.test.ts`, `invariant-owner-isolation.test.ts`)
- **Pattern**: Each test uses `vitest` with `describe/invariant-` blocks; uses `assert` for stable public error codes; avoids secrets in test data.
- **Adversarial cases**: Wrong owner id, execution agent requesting memory, capability not in agent config, seal true but code path still attempted, pending memory injected into context builder, etc.
- **Run**: `pnpm test` must include all new tests; no existing test may break.

---

## Residual Risks / TODOs (for later tranches)

- [ ] Real CEX/on-chain order placement (out of scope for this tranche).
- [ ] New agent roles or taxonomy redesign (later tranche).
- [ ] Full policy-UX redesign (later tranche).
- [ ] External policy engine framework integration (not present; strengthen existing registry + server checks first).
- [ ] Dual MySQL/Postgres adapter invariants for non-active driver paths.