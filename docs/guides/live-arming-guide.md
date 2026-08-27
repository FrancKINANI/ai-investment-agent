# Live Arming Guide

Step-by-step guide to enable real Binance execution in Ledgerline.

**Default state:** Paper execution only. No real capital at risk.
**Arming requires:** 5 deliberate owner actions. Nothing is automatic.

---

## Prerequisites

- Ledgerline running on `staging` or `production`
- Binance account with API access
- Authority state machine accessible (Settings → Authority)

---

## Step 1: Enable the CEX feature flag

The CEX execution flag is `false` by default. Nothing live can happen without this.

**Via config file:**
```yaml
# config/default.yaml or config/local.yaml
featureFlags:
  cexExecution: true
```

**Via CLI (inspection only — shows what to do):**
```bash
ledgerline execution switch cex
# Returns step-by-step guide if flag is off
```

**Verify:**
```bash
ledgerline execution status
# cexEnabled: true
```

---

## Step 2: Add and verify a Binance API key

**Via UI:** Settings → Platforms → Add Key

1. Enter your Binance API key and secret
2. Select permissions: `spot:read` and `spot:trade` (trading only)
3. **Withdrawal-scoped keys are hard-rejected** — never stored
4. Click "Test Connection" — this calls Binance's read-only account endpoint
5. Key state changes to `active` only after successful verification

**Via API:**
```typescript
// Add key (encrypted at rest with AES-256-GCM)
trpc.security.platforms.addKey.mutate({
  platform: "binance",
  label: "Trading Key",
  apiKey: "your-api-key",
  apiSecret: "your-api-secret",
  permissions: ["spot:read", "spot:trade"],
  hasWithdrawPermission: false, // Must be false
});

// Verify (calls real Binance endpoint)
trpc.security.platforms.testConnection.mutate({
  keyId: "key-1",
});
```

**What happens on verification:**
- Binance `GET /api/v3/account` is called with your key
- If successful → key state = `active`
- If failed → key state = `disabled`, security alert emitted
- No orders are placed during verification

---

## Step 3: Create a wallet mandate with mode: real

A mandate defines what the agent can do: which venue, which assets, order limits.

**Via UI:** Settings → Wallets → Create Mandate

1. Select venue: **Binance**
2. Select wallet role: **Trading**
3. Set allowed assets: e.g., `["BTCUSDT", "ETHUSDT"]`
4. Set max order size: e.g., `250` bps (2.5% of balance)
5. Set daily cap: e.g., `1000` bps (10% of balance)
6. Set mode: **real**

**Via API:**
```typescript
trpc.autonomy.createSimulationMandate.mutate({
  walletRole: "trading",
  venue: "binance",
  allowedAssets: ["BTCUSDT", "ETHUSDT"],
  maxOrderBps: 250,   // Max 2.5% per order
  dailyCapBps: 1000,  // Max 10% per day
});

// Then switch to real mode
trpc.autonomy.setMandateMode.mutate({
  mandateId: "mandate-1",
  mode: "real",
});
```

**Mandate mode requirements for real:**
- Authority state must be `approval-required-live` or `limited-live`
- Active IPS (Investment Policy Statement) must exist
- Both checks are server-side — cannot be bypassed

---

## Step 4: Transition authority state

The authority state machine is the master gate. You must climb it deliberately.

**Current state flow:**
```
disabled → sandbox-only → read-only-live → approval-required-live → limited-live
```

**Each transition requires:**
- Explicit owner action
- A reason (logged)
- One step at a time (no skipping)

**Via UI:** Settings → Authority → Transition

**Via API:**
```typescript
// Step 4a: disabled → sandbox-only
trpc.authority.transition.mutate({
  to: "sandbox-only",
  reason: "Enabling paper execution testing",
});

// Step 4b: sandbox-only → read-only-live
trpc.authority.transition.mutate({
  to: "read-only-live",
  reason: "Enabling live market data reads",
});

// Step 4c: read-only-live → approval-required-live
trpc.authority.transition.mutate({
  to: "approval-required-live",
  reason: "Enabling live order placement with per-order approval",
});
```

**What each state allows:**

| State | Can read live data | Can place orders | Notes |
|---|---|---|---|
| `disabled` | ❌ | ❌ | Default. Paper only. |
| `sandbox-only` | ❌ | ❌ | Paper execution only. |
| `read-only-live` | ✅ | ❌ | Real market data, no orders. |
| `approval-required-live` | ✅ | ✅ | Each order requires owner approval. |
| `limited-live` | ✅ | ✅ | Limited autonomy within mandate. |

**Kill switch:** Transition to `paused` or `revoked` at any time.

---

## Step 5: Switch execution backend to CEX

**Via CLI:**
```bash
ledgerline execution switch cex
```

**Via API:**
```typescript
trpc.system.switchExecutionBackend.mutate({
  backend: "cex",
});
```

**Verify:**
```bash
ledgerline execution status
# activeBackend: "cex"
# cexEnabled: true
```

---

## Arming Checklist

```
[ ] Step 1: featureFlags.cexExecution: true
[ ] Step 2: Binance API key added + verified (state: active)
[ ] Step 3: Wallet mandate created (venue: binance, mode: real)
[ ] Step 4: Authority state → approval-required-live
[ ] Step 5: Execution backend → cex
[ ] Verify: ledgerline execution status shows activeBackend: cex
```

---

## Disarming (Emergency)

To immediately stop all live execution:

**Option A: Kill switch (fastest)**
```typescript
trpc.authority.transition.mutate({
  to: "paused",
  reason: "Emergency stop — pausing all live execution",
});
```

**Option B: Switch back to paper**
```typescript
trpc.system.switchExecutionBackend.mutate({
  backend: "paper",
});
```

**Option C: Revoke (terminal)**
```typescript
trpc.authority.transition.mutate({
  to: "revoked",
  reason: "Permanent revocation of live authority",
});
// Requires fresh provisioning to re-enable
```

**Option D: Disable the feature flag**
```yaml
# config/local.yaml
featureFlags:
  cexExecution: false
```

---

## Order Flow (What Happens)

```
1. Research agent proposes a trade
   ↓
2. Policy + hard gates run server-side
   ↓
3. Proposal appears in owner review queue
   ↓
4. Owner approves (admin-only, rate-limited)
   ↓
5. Orchestrator checks:
   - Authority state permits orders
   - Mandate mode is "real" or "armed"
   - Active Binance API key exists
   - Per-order approval consumed (approval-required-live)
   - Price freshness for market orders
   - Order within mandate limits
   ↓
6. CEX backend submits to Binance
   ↓
7. Ledger records: submitted → filled/rejected
   ↓
8. Alert emitted on fill or reject
   ↓
9. Activity log updated
```

---

## Safety Guarantees

| Guard | Enforcement |
|---|---|
| Authority state | Server-side, checked on every order |
| Mandate limits | Server-side, checked before submission |
| Per-order approval | Single-use, owner-bound, action-bound |
| Price freshness | Market orders rejected if stale |
| Idempotency | Duplicate keys return original result |
| Withdrawal hard-reject | Schema-level, never stored |
| Audit trail | Every action logged to Activity |
| Alerts | Emitted on fill, reject, and authority blocks |
| Kill switch | `paused`/`revoked` dominates all other states |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `ledgerline execution switch cex` shows "blocked" | Set `featureFlags.cexExecution: true` in config |
| Order rejected "No active Binance API key" | Add + verify key in Settings → Platforms |
| Order rejected "Mandate mode is simulation" | Switch mandate to `real` mode |
| Order rejected "Authority state does not permit" | Climb authority state machine to `approval-required-live` |
| Order rejected "No active mandate" | Create a wallet mandate for venue: binance |
| Key verification failed | Check API key permissions, ensure trading-only |
| Live data shows "authority-blocked" | Authority state too low for live reads |
