# Ledgerline Phase 0: Slices 1–3 Implementation Summary

**Date:** 2026-Q4 · **Branch:** staging · **Previous:** Stages 0–4 merged to main

---

## Overview

Ledgerline Slices 1–3 transform the system from hardcoded simulation theater into a **real, owner-controlled investment OS** with configuration-driven agents, runtime-enforced capability bindings, and pluggable execution backends.

| Slice | Goal | Status |
|-------|------|--------|
| **1** | Config-driven agent team (no more hardcoded roles) | ✅ Complete |
| **2** | Runtime capability binding enforcement | ✅ Complete |
| **3** | Execution backend abstraction + orchestrator | 🔄 In Progress (logic complete, integration pending) |

**Key principle:** Owner controls everything via YAML. Agent team → capabilities → execution all configured, not hard-coded.

---

## Slice 1: Config-Driven Agent Team

### Problem Solved
- Agent roles, models, and capabilities were hardcoded in `agentFabric.ts`
- Research model was hardcoded `"gpt-5-mini"` with no way to override
- Owner pause state was hardcoded `false`; research advanced even if owner was paused/revoked

### Solution Implemented

**1. Agent Team YAML Config**
```yaml
# config/agents/team.yaml
schemaVersion: 1
defaultModel: gpt-4-turbo
defaultProvider: openai
agents:
  - id: variation
    model: claude-opus
    enabled: true
    layer: research
    canExecute: false
    capabilities: [market-evidence.read, chain-evidence.read]
```

**2. Agent Team Loader**
- `shared/agentTeam.ts`: `loadAgentTeam()` loads and caches team YAML at startup
- `findTeamRole(roleKey)` replaces hardcoded role lookups
- `delegationRoleKeys()` returns enabled delegation targets

**3. Research Model Wiring**
- `server/routers.ts` analyzeToken mutation reads model from variation agent spec instead of hardcoded value
- Model can now be changed via YAML without code redeploy

**4. Owner Authority Wiring**
- `server/research.ts` now calls `getAuthorityState(userId)` and passes real value to decision kernel
- Research blocks if owner is paused/revoked (S1 audit finding fixed)

**5. CLI Tools**
```bash
ledgerline agents list                      # All agents with models/capabilities
ledgerline agents list --layer research     # Filter by layer
ledgerline agents list --enabled-only       # Only enabled agents
```

### Tests
- ✅ All 13 agents load with correct attributes
- ✅ Model overrides respected
- ✅ Paused owner blocks research

### Impact
- **Before:** 13 hardcoded role specifications scattered across agentFabric.ts
- **After:** 1 YAML source of truth; CLI inspection; per-agent model configuration; authority state honored

---

## Slice 2: Registry Bindings Enforcement

### Problem Solved
- Capability registry was defined but never enforced at runtime
- Agents could theoretically access tools/research they shouldn't
- Capability bindings were theater—visible in config but ignored in code

### Solution Implemented

**1. Capability Access Validator**
```typescript
// shared/capabilityRegistry.ts
validateCapabilityAccess(roleKey, requiredCapabilities): Capability[]
```
- Checks role→capability bindings exist
- Verifies capability is active (not disabled/planned)
- Throws FORBIDDEN if binding missing
- Returns list of granted capabilities for audit logging

**2. Routing-Level Enforcement**
- `server/routers.ts` sendSupervisorMessage mutation validates specialist capabilities before delegation
- `server/routers.ts` analyzeToken mutation validates research capabilities before running
- Fail-closed: if binding missing, TRPCError(FORBIDDEN); no fallback

**3. Audit Logging**
- `createCapabilityProvenance()` records which capabilities were used
- Operator actions include capability list in payload
- Decision Journal shows who accessed what

### Tests
- ✅ Capability validation rejects unbound agents
- ✅ Capabilities logged in operator actions
- ✅ Fail-closed behavior verified

### Impact
- **Before:** Bindings defined but ignored; agent could access any capability
- **After:** Every research call verifies agent has binding; fail-closed default

---

## Slice 3: Execution Backend Abstraction

### Problem Solved
- Execution hardcoded to paper (deterministic simulator)
- No clean way to swap backends (paper → CEX → on-chain)
- Decision logic coupled to paperExecutor implementation
- Difficult to test different execution scenarios

### Solution Implemented

**1. ExecutionBackend Interface**
```typescript
// shared/executionBackend.ts
interface ExecutionBackend {
  readonly type: "paper" | "cex" | "onchain";
  readonly label: string;
  verify(): Promise<void>;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
```
- Unified contract: all backends implement same interface
- Caller doesn't know or care which backend is active
- Pluggable: swap `config/execution/backend.yaml` to switch

**2. Paper Backend Implementation**
```typescript
// server/backends/paper.backend.ts
class PaperExecutionBackend implements ExecutionBackend
```
- Wraps existing `submitPaperOrder` logic
- Performs S2 authority checks + mandate validation
- Returns typed ExecutionResult

**3. CEX & On-chain Stubs**
```typescript
// server/backends/cex.backend.ts
// server/backends/onchain.backend.ts
```
- Phase 2+ placeholders
- Authority checks in place
- Ready for API integration (Binance, OKX, Sailor/WalletConnect)

**4. Backend Registry**
```typescript
// server/backends/registry.ts
getExecutionBackendRegistry(): ExecutionBackendRegistry
```
- Singleton registry loads backends at startup
- `active()` returns configured backend
- Paper always available; others may throw if not configured

**5. Execution Orchestrator**
```typescript
// server/runtime/executionOrchestrator.ts
evaluateProposalApproval(input): ApprovalResult       // Apply hard gate
executeApprovedProposal(input): ExecutionOrchestratorResult  // Call backend, record result
```
- Separates orchestration logic from HTTP router
- Reusable for different execution flows
- **NOT YET INTEGRATED** into routers (pending integration phase)

**6. Backend Configuration**
```yaml
# config/execution/backend.yaml
active: paper
backends:
  paper: { enabled: true, riskLevel: "none" }
  cex: { enabled: false, riskLevel: "high", requiresAuth: true }
  onchain: { enabled: false, riskLevel: "high", requiresAuth: true }
```
- YAML controls which backends are available
- Per-backend auth requirements, risk levels, phase gates
- Change `active: paper` → `active: cex` to swap backends (Phase 2)

**7. Documentation Overhaul**
- **[README.md]** rewritten: "fail-closed" → "real, owner-controlled OS with pluggable backends"
- Architecture diagram shows unified pipeline + swappable backends
- Configuration-driven control section explains agent/binding/backend YAML
- Phase roadmap: Phase 0-1 (OS layer), Phase 2 (CEX), Phase 3 (on-chain)
- **[docs/architecture-audit.md]** updated: Slice 1-3 progress + findings

### Remaining Integration Work
- Wire orchestrator into `routers.ts` approveProposal + settleSimulation
- Load proposal order details (symbol, side, quantity, limitPrice)
- Test end-to-end: proposal → approval → execution
- S2 audit fix: Derive gate inputs server-side (not from client)
- S3 audit fix: Hard-gate at kernel level in orchestrator

### Impact
- **Before:** Execution hardcoded to paper; CEX/on-chain blocked in config with no clean swap path
- **After:** Pluggable backends with same decision pipeline; swap backend via YAML config; Phase 2/3 ready

---

## Architecture: Unified Pipeline with Pluggable Backends

```
                          Research
                            ↓
                   Agent Fabric (config-driven)
                            ↓
                  Policy + Hard Gates (IPS, Risk)
                            ↓
                      Owner Approval
                            ↓
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
    Paper Backend       CEX Backend      On-chain Backend
   (Simulation)    (Binance, OKX, etc)   (Sailor, Wallet)
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    Execution Result
                            ↓
            Decision Journal + Audit Trail
```

**Key insight:** Paper, CEX, and on-chain are interchangeable backends. Same decision pipeline. Different execution layer. Swap backends via config—no code changes.

---

## Configuration Files

### 1. Agent Team
**File:** `config/agents/team.yaml`
```yaml
schemaVersion: 1
defaultModel: gpt-4-turbo
agents:
  - id: macro
    model: gpt-4-turbo
    enabled: true
    layer: research
    capabilities: [market-evidence.read]
```

### 2. Capability Bindings
**File:** `config/bindings/protected-roles.yaml`
```yaml
bindings:
  - capabilityId: market-evidence.read
    roleKeys: [macro, onchain, variation]
    permission: research-only
```

### 3. Execution Backend
**File:** `config/execution/backend.yaml`
```yaml
active: paper
backends:
  paper: { enabled: true }
  cex: { enabled: false }
```

---

## CLI Tools

| Command | Purpose |
|---------|---------|
| `ledgerline agents list` | Show all agents + models + enabled status |
| `ledgerline agents list --layer research` | Filter by agent layer |
| `ledgerline agents list --enabled-only` | Only enabled agents |
| `ledgerline capabilities list` | Show all capabilities + bindings |
| `ledgerline bindings show [ROLE]` | Show bindings for role or all |
| `ledgerline config show [SECTION]` | Inspect config (agents, capabilities, bindings, execution) |
| `ledgerline doctor` | Validation checks |

---

## Security Findings & Fixes

| Finding | Status | Fix |
|---------|--------|-----|
| S1: ownerPauseActive hardcoded | ✅ Fixed | Read from authority state in research.ts |
| S2: Client-supplied gate evidence | 🔄 In Progress | Orchestrator will derive inputs server-side |
| S3: No kernel validation | 🔄 In Progress | Orchestrator adds validation layer + tests |

---

## Test Coverage

- ✅ Agent team loading + model overrides
- ✅ Capability validation + fail-closed behavior
- ✅ Paused owner blocks research
- ✅ Backend registry + active backend selection
- 🔄 End-to-end proposal → approval → execution (pending orchestrator integration)

---

## What's Next (Slice 3 Integration + Phase 2)

**Immediate (Slice 3 Integration):**
1. Wire orchestrator into routers.ts
2. Load proposal order details
3. Test end-to-end execution
4. Fix S2/S3 audit findings

**Phase 2 (CEX Execution):**
1. Implement CEX backend API integration (Binance, OKX, Kraken)
2. API key management + KMS
3. Real order placement + fills
4. Mandate limit enforcement

**Phase 3 (On-chain Execution):**
1. Sailor protocol integration
2. WalletConnect + transaction signing
3. Non-custodial execution
4. Multi-chain support

---

## Files Changed (Slices 1–3)

### New Files
- `config/agents/team.yaml` — Agent team configuration
- `config/execution/backend.yaml` — Backend selection config
- `shared/agentTeam.ts` — Agent loader (Slice 1)
- `shared/executionBackend.ts` — Backend interface (Slice 3)
- `server/backends/paper.backend.ts` — Paper backend (Slice 3)
- `server/backends/cex.backend.ts` — CEX backend stub (Slice 3)
- `server/backends/onchain.backend.ts` — On-chain backend stub (Slice 3)
- `server/backends/registry.ts` — Backend registry (Slice 3)
- `server/runtime/executionOrchestrator.ts` — Orchestrator logic (Slice 3)
- `docs/slices-1-3-summary.md` — This document

### Modified Files
- `server/research.ts` — Wire authority state (Slice 1)
- `server/routers.ts` — Load model from team config, validate capabilities (Slices 1-2)
- `shared/capabilityRegistry.ts` — Add validation function (Slice 2)
- `scripts/ledgerline.mjs` — Add agents CLI command (Slice 1)
- `README.md` — Rewrite to reflect real OS (Slice 3)
- `docs/architecture-audit.md` — Update with Slice progress (Slices 1-3)

---

## Commands for Testing

```bash
# Validate config
pnpm run ledgerline config validate

# List agents
pnpm run ledgerline agents list

# Show execution backend config
pnpm run ledgerline config show execution

# Run tests
pnpm test

# Type check
pnpm check
```

---

## How Owner Control Works

1. **Agent team:** Owner edits `config/agents/team.yaml` to enable/disable agents, swap models, adjust capabilities
2. **Capabilities:** Owner reviews `config/bindings/protected-roles.yaml` to see who can access what
3. **Execution backend:** Owner changes `config/execution/backend.yaml` active field to swap between paper/CEX/on-chain
4. **Authority state:** Owner climbs the authority state machine in the UI (disabled → approval-required-live → limited-live)
5. **Hard gates:** Owner approves proposals; system enforces policy + risk limits + evaluator veto

Result: **No simulation theater. Real decisions. Real policy. Real execution (when authorized).**

---

## References

- [Ledgerline README](../../README.md)
- [Architecture Audit](../architecture-audit.md)
- [Security & Data Boundaries](security-and-data.md)
- [Roadmap](../roadmap.md)
