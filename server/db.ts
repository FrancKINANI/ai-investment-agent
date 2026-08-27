import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { agentProfiles, agentProposals, agentRuns, authorityControls, liveOrderApprovals, awarenessRecords, bindingChangeRequests, executionLedger, InsertUser, securityAlerts, paperOrders, platformApiKeys, investmentPolicies, operatorActions, outcomeRecords, strategyEvaluations, strategyLineages, users, venueConnections, walletMandates } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { createCapabilityProvenance } from "@shared/capabilityRegistry";
import { nanoid } from "nanoid";
import { AUTHORITY_STATE_MACHINE_VERSION, AuthorityState, evaluateAuthorityTransition } from "@shared/authorityState";
import type { LedgerEventType } from "@shared/paperExecution";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { ...user, lastSignedIn: user.lastSignedIn ?? new Date() };
  if (!values.role && user.openId === ENV.ownerOpenId) values.role = "admin";
  await db.insert(users).values(values).onDuplicateKeyUpdate({
    set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: new Date() },
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listAgentProfiles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentProfiles).where(eq(agentProfiles.userId, userId));
}

export async function listAgentRuns(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentRuns).where(eq(agentRuns.userId, userId)).orderBy(desc(agentRuns.createdAt)).limit(30);
}

export async function createAgentRun(userId: number, run: {
  runId: string;
  status: "passed" | "review" | "blocked";
  policyResult: "pass" | "review" | "block";
  summary: string;
  evidence: string[];
  simulationOnly?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentRuns).values({ userId, ...run, simulationOnly: run.simulationOnly ?? true });
  const saved = await db.select().from(agentRuns).where(eq(agentRuns.runId, run.runId)).limit(1);
  return saved[0];
}

export type PolicyValues = {
  name: string;
  maxConcentrationBps: number;
  minReserveBps: number;
  maxTransactionBps: number;
  dailyMandateBps: number;
  allowedAssets: string[];
};

export async function getInvestmentPolicy(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(investmentPolicies).where(eq(investmentPolicies.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function saveInvestmentPolicy(userId: number, values: PolicyValues) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const current = await getInvestmentPolicy(userId);
  const nextVersion = (current?.version ?? 0) + 1;
  await db.insert(investmentPolicies).values({
    userId,
    version: nextVersion,
    ...values,
    executionMode: "simulation",
    active: true,
  }).onDuplicateKeyUpdate({
    set: {
      version: nextVersion,
      ...values,
      executionMode: "simulation",
      active: true,
      updatedAt: new Date(),
    },
  });
  return getInvestmentPolicy(userId);
}

export type OperatorActionInput = {
  actionId: string;
  kind: "policy_updated" | "simulation_started" | "simulation_blocked" | "onchain_viewed" | "scope_checked" | "outcome_recorded" | "promotion_changed" | "research_completed" | "mandate_created" | "mandate_mode_changed" | "venue_configured" | "proposal_created" | "proposal_approved" | "proposal_rejected" | "simulation_settled" | "agent_configured" | "subagent_created" | "subagent_retired" | "chat_message" | "watchlist_created" | "watchlist_updated" | "discovery_schedule_configured" | "discovery_completed" | "platform_key_added" | "platform_key_removed" | "platform_key_disabled" | "wallet_connected" | "wallet_disconnected" | "mode_changed" | "authority_changed" | "alert_created" | "alert_acknowledged";
  status: "success" | "review" | "blocked";
  subject: string;
  detail: string;
  payload: Record<string, unknown>;
  capabilityIds?: string[];
};

const defaultCapabilityIdsByAction: Partial<Record<OperatorActionInput["kind"], string[]>> = {
  research_completed: ["market-evidence.read", "chain-evidence.read"],
  proposal_created: ["paper-proposal.compose"],
  proposal_approved: ["paper-proposal.compose", "portfolio-snapshot.read"],
  proposal_rejected: ["paper-proposal.compose"],
  simulation_started: ["portfolio-snapshot.read", "paper-proposal.compose"],
  simulation_settled: ["portfolio-snapshot.read", "paper-proposal.compose"],
  onchain_viewed: ["chain-evidence.read"],
  discovery_completed: ["market-evidence.read", "chain-evidence.read"],
};

export async function createOperatorAction(userId: number, action: OperatorActionInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const { capabilityIds, payload, ...record } = action;
  const provenance = createCapabilityProvenance(capabilityIds ?? defaultCapabilityIdsByAction[action.kind] ?? []);
  await db.insert(operatorActions).values({ userId, ...record, payload: { ...payload, provenance } });
  const saved = await db.select().from(operatorActions).where(eq(operatorActions.actionId, action.actionId)).limit(1);
  return saved[0];
}

export async function listOperatorActions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operatorActions).where(eq(operatorActions.userId, userId)).orderBy(desc(operatorActions.createdAt)).limit(80);
}

export type BindingChangeRequestValues = { requestId: string; capabilityId: string; roleKeys: string[]; permission: "research-only" | "simulation-only"; rationale: string };

export async function createBindingChangeRequest(userId: number, request: BindingChangeRequestValues) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(bindingChangeRequests).values({ userId, ...request, status: "pending", reviewerUserId: null, reviewNote: null, reviewedAt: null });
  const saved = await db.select().from(bindingChangeRequests).where(eq(bindingChangeRequests.requestId, request.requestId)).limit(1);
  return saved[0] ?? null;
}

export async function listBindingChangeRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bindingChangeRequests).where(eq(bindingChangeRequests.userId, userId)).orderBy(desc(bindingChangeRequests.updatedAt)).limit(40);
}

export async function getBindingChangeRequest(userId: number, requestId: string) {
  const db = await getDb();
  if (!db) return null;
  const saved = await db.select().from(bindingChangeRequests).where(and(eq(bindingChangeRequests.userId, userId), eq(bindingChangeRequests.requestId, requestId))).limit(1);
  return saved[0] ?? null;
}

export async function reviewBindingChangeRequest(userId: number, requestId: string, reviewerUserId: number, status: "approved" | "rejected", reviewNote: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(bindingChangeRequests).set({ status, reviewerUserId, reviewNote, reviewedAt: new Date(), updatedAt: new Date() }).where(and(eq(bindingChangeRequests.userId, userId), eq(bindingChangeRequests.requestId, requestId), eq(bindingChangeRequests.status, "pending")));
  return getBindingChangeRequest(userId, requestId);
}

export type WalletMandateValues = { mandateId: string; walletRole: "trading" | "investment"; venue: "binance" | "evm" | "polymarket"; mode: "simulation" | "armed" | "real" | "paused"; status: "active" | "paused" | "disconnected"; allowedAssets: string[]; maxOrderBps: number; dailyCapBps: number; };

export async function createWalletMandate(userId: number, values: WalletMandateValues) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(walletMandates).values({ userId, ...values });
  const saved = await db.select().from(walletMandates).where(eq(walletMandates.mandateId, values.mandateId)).limit(1);
  return saved[0];
}

export async function listWalletMandates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletMandates).where(eq(walletMandates.userId, userId)).orderBy(desc(walletMandates.updatedAt));
}

export async function updateWalletMandateMode(userId: number, mandateId: string, mode: "simulation" | "armed" | "real" | "paused") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(walletMandates).set({ mode, status: mode === "paused" ? "paused" : "active", updatedAt: new Date() }).where(and(eq(walletMandates.userId, userId), eq(walletMandates.mandateId, mandateId)));
  const saved = await db.select().from(walletMandates).where(and(eq(walletMandates.userId, userId), eq(walletMandates.mandateId, mandateId))).limit(1);
  return saved[0] ?? null;
}

export async function createVenueConnection(userId: number, values: { connectionId: string; venue: "binance" | "evm" | "polymarket"; state: "disconnected" | "simulation" | "armed" | "real"; capabilities: string[]; credentialRef?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(venueConnections).values({ userId, ...values, credentialRef: values.credentialRef ?? null });
  const saved = await db.select().from(venueConnections).where(eq(venueConnections.connectionId, values.connectionId)).limit(1);
  return saved[0];
}

export async function listVenueConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(venueConnections).where(eq(venueConnections.userId, userId)).orderBy(desc(venueConnections.updatedAt));
}

export async function createAgentProposal(userId: number, values: { proposalId: string; runId?: string; walletRole: "trading" | "investment"; venue: "binance" | "evm" | "polymarket"; status: "review" | "approved" | "rejected" | "simulated" | "blocked"; policyResult: "pass" | "review" | "block"; title: string; rationale: string; action: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentProposals).values({ userId, ...values, runId: values.runId ?? null });
  const saved = await db.select().from(agentProposals).where(eq(agentProposals.proposalId, values.proposalId)).limit(1);
  return saved[0];
}

export async function listAgentProposals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentProposals).where(eq(agentProposals.userId, userId)).orderBy(desc(agentProposals.updatedAt)).limit(40);
}

export async function getAgentProposal(userId: number, proposalId: string) {
  const db = await getDb();
  if (!db) return null;
  const saved = await db.select().from(agentProposals).where(and(eq(agentProposals.userId, userId), eq(agentProposals.proposalId, proposalId))).limit(1);
  return saved[0] ?? null;
}

export async function updateAgentProposalStatus(userId: number, proposalId: string, status: "review" | "approved" | "rejected" | "simulated" | "blocked") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(agentProposals).set({ status, updatedAt: new Date() }).where(and(eq(agentProposals.userId, userId), eq(agentProposals.proposalId, proposalId)));
  return getAgentProposal(userId, proposalId);
}

export async function createAwarenessRecord(userId: number, record: {
  layer: "action" | "justification" | "result" | "evolutionary";
  subject: string;
  runId?: string;
  evidence: string[];
  summary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(awarenessRecords).values({ userId, ...record });
  const saved = await db.select().from(awarenessRecords).where(eq(awarenessRecords.userId, userId)).orderBy(desc(awarenessRecords.createdAt)).limit(1);
  return saved[0];
}

export async function listAwarenessRecords(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(awarenessRecords).where(eq(awarenessRecords.userId, userId)).orderBy(desc(awarenessRecords.createdAt)).limit(80);
}

export async function listStrategyLineages(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(strategyLineages).where(eq(strategyLineages.userId, userId)).orderBy(desc(strategyLineages.updatedAt)).limit(80);
}

export async function listStrategyEvaluations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(strategyEvaluations).where(eq(strategyEvaluations.userId, userId)).orderBy(desc(strategyEvaluations.createdAt)).limit(80);
}

export async function listOutcomeRecords(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(outcomeRecords).where(eq(outcomeRecords.userId, userId)).orderBy(desc(outcomeRecords.updatedAt)).limit(80);
}

export async function createStrategyLineage(userId: number, record: {
  lineageId: string;
  name: string;
  stage: "research" | "simulation" | "decision" | "retired";
  generation: number;
  parentVersion?: string;
  scores: Record<string, number>;
  rationale: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(strategyLineages).values({ userId, ...record, parentVersion: record.parentVersion ?? null });
  const saved = await db.select().from(strategyLineages).where(eq(strategyLineages.userId, userId)).orderBy(desc(strategyLineages.createdAt)).limit(1);
  return saved[0];
}

export async function createStrategyEvaluation(userId: number, record: {
  lineageId: string;
  version: string;
  gateResult: "pass" | "review" | "block";
  simulationPassed: boolean;
  coverage: number;
  complexityPenalty: number;
  rationale: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(strategyEvaluations).values({ userId, ...record });
  const saved = await db.select().from(strategyEvaluations).where(eq(strategyEvaluations.userId, userId)).orderBy(desc(strategyEvaluations.createdAt)).limit(1);
  return saved[0];
}

export async function createOutcomeRecord(userId: number, record: {
  lineageId: string;
  runId?: string;
  expectedBps: number;
  realizedBps?: number;
  attribution: Record<string, number>;
  deviation: "on_track" | "underperforming" | "outperforming" | "inconclusive";
  narrative: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(outcomeRecords).values({ userId, ...record, runId: record.runId ?? null, realizedBps: record.realizedBps ?? null });
  const saved = await db.select().from(outcomeRecords).where(eq(outcomeRecords.userId, userId)).orderBy(desc(outcomeRecords.createdAt)).limit(1);
  return saved[0];
}

// ─── Security Alerts ───────────────────────────────────────────────────────


export async function createSecurityAlert(userId: number, alert: {
  alertId: string;
  level: "critical" | "warning" | "info";
  category: string;
  title: string;
  detail: string;
  actionRef?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(securityAlerts).values({ userId, ...alert, actionRef: alert.actionRef ?? null });
  const saved = await db.select().from(securityAlerts).where(eq(securityAlerts.alertId, alert.alertId)).limit(1);
  return saved[0];
}

export async function listSecurityAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(securityAlerts).where(eq(securityAlerts.userId, userId)).orderBy(desc(securityAlerts.createdAt)).limit(100);
}

export async function acknowledgeSecurityAlert(userId: number, alertId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(securityAlerts).set({ acknowledged: true, updatedAt: new Date() }).where(and(eq(securityAlerts.userId, userId), eq(securityAlerts.alertId, alertId)));
  const saved = await db.select().from(securityAlerts).where(and(eq(securityAlerts.userId, userId), eq(securityAlerts.alertId, alertId))).limit(1);
  return saved[0] ?? null;
}

export async function countUnacknowledgedAlerts(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(securityAlerts).where(and(eq(securityAlerts.userId, userId), eq(securityAlerts.acknowledged, false)));
  return result.length;
}

// ─── Platform API Keys ─────────────────────────────────────────────────────

export async function createPlatformApiKey(userId: number, key: {
  keyId: string;
  platform: "binance" | "okx" | "coinbase" | "kraken" | "polymarket";
  label: string;
  keyPrefix: string;
  apiKeyEncrypted: string;
  secretEncrypted: string;
  permissions: string[];
  hasWithdrawPermission: boolean;
  maxOrderUsd?: number;
  allocatedCapitalUsd?: number;
  dailyTradeLimit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(platformApiKeys).values({
    userId,
    ...key,
    maxOrderUsd: key.maxOrderUsd ?? null,
    allocatedCapitalUsd: key.allocatedCapitalUsd ?? null,
    dailyTradeLimit: key.dailyTradeLimit ?? null,
  });
  const saved = await db.select().from(platformApiKeys).where(eq(platformApiKeys.keyId, key.keyId)).limit(1);
  return saved[0];
}

export async function listPlatformApiKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(platformApiKeys).where(eq(platformApiKeys.userId, userId)).orderBy(desc(platformApiKeys.createdAt));
}

export async function getPlatformApiKey(userId: number, keyId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(platformApiKeys).where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId))).limit(1);
  return result[0] ?? null;
}

export async function updatePlatformApiKeyState(userId: number, keyId: string, state: "active" | "disabled" | "testing") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(platformApiKeys).set({ state, updatedAt: new Date() }).where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId)));
  return getPlatformApiKey(userId, keyId);
}

export async function updatePlatformApiKeyLimits(userId: number, keyId: string, limits: {
  maxOrderUsd?: number;
  allocatedCapitalUsd?: number;
  dailyTradeLimit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(platformApiKeys).set({ ...limits, updatedAt: new Date() }).where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId)));
  return getPlatformApiKey(userId, keyId);
}

export async function deletePlatformApiKey(userId: number, keyId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await getPlatformApiKey(userId, keyId);
  if (!existing) return null;
  await db.delete(platformApiKeys).where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId)));
  return existing;
}

// ─── Authority control (Ledgerline real-mode state machine) ────────────────

export async function getAuthorityState(userId: number): Promise<AuthorityState> {
  const db = await getDb();
  // Fail closed: no record (or no database) means disabled.
  if (!db) return "disabled";
  const result = await db.select().from(authorityControls).where(eq(authorityControls.userId, userId)).limit(1);
  return AuthorityState.parse(result[0]?.state ?? "disabled");
}

export type AuthorityChangeResult =
  | { ok: true; from: AuthorityState; to: AuthorityState }
  | { ok: false; reason: string };

/**
 * Owner-initiated authority transition. Validates the edge against the
 * versioned state machine and writes an audit record. Never called by agents.
 */
export async function changeAuthorityState(
  userId: number,
  to: AuthorityState,
  initiatedBy: string,
  reason: string,
): Promise<AuthorityChangeResult> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "Database unavailable; refusing authority transition (fail closed)." };
  const from = await getAuthorityState(userId);
  const validation = evaluateAuthorityTransition({ from, to, initiatedBy, reason });
  if (!validation.allowed) return { ok: false, reason: validation.reason };

  await db
    .insert(authorityControls)
    .values({ userId, state: to, machineVersion: AUTHORITY_STATE_MACHINE_VERSION, updatedBy: initiatedBy, reason })
    .onDuplicateKeyUpdate({
      set: { state: to, machineVersion: AUTHORITY_STATE_MACHINE_VERSION, updatedBy: initiatedBy, reason, updatedAt: new Date() },
    });

  await createOperatorAction(userId, {
    actionId: nanoid(),
    kind: "authority_changed",
    status: "success",
    subject: `Authority ${from} → ${to}`,
    detail: `Owner-initiated authority transition (${initiatedBy}): ${reason}`,
    payload: { from, to, initiatedBy, machineVersion: AUTHORITY_STATE_MACHINE_VERSION },
  });

  return { ok: true, from, to };
}

// ─── Paper execution: append-only ledger + projection ──────────────────────

export async function getPaperOrderByIdempotencyKey(userId: number, idempotencyKey: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(paperOrders)
    .where(and(eq(paperOrders.userId, userId), eq(paperOrders.idempotencyKey, idempotencyKey)))
    .limit(1);
  return rows[0] ?? null;
}

/** Append one immutable ledger event. Never updates existing events. */
export async function appendLedgerEvent(userId: number, event: {
  eventId?: string;
  orderId: string;
  idempotencyKey: string;
  venue: "binance" | "evm" | "polymarket";
  executionMode: "paper" | "sandbox" | "live";
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity?: string | null;
  price?: string | null;
  quoteOrderQty?: string | null;
  seq: number;
  eventType: LedgerEventType;
  payload: Record<string, unknown>;
  mandateId?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable; refusing to write execution event (fail closed).");
  await db.insert(executionLedger).values({ userId, ...event, eventId: event.eventId ?? nanoid() });
}

export async function upsertPaperOrderProjection(userId: number, order: {
  orderId: string;
  idempotencyKey: string;
  venue: "binance" | "evm" | "polymarket";
  executionMode: "paper" | "sandbox" | "live";
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity?: string | null;
  price?: string | null;
  quoteOrderQty?: string | null;
  status: "proposed" | "validated" | "submitted" | "filled" | "rejected" | "cancelled" | "reconciled";
  reconciliationState?: "pending" | "matched" | "mismatched";
  fillPrice?: string | null;
  executedQty?: string | null;
  mandateId?: string | null;
  rejectReason?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable; refusing to update paper order projection (fail closed).");
  await db.insert(paperOrders).values({ userId, ...order })
    .onDuplicateKeyUpdate({ set: {
      status: order.status,
      reconciliationState: order.reconciliationState ?? "pending",
      fillPrice: order.fillPrice ?? null,
      executedQty: order.executedQty ?? null,
      rejectReason: order.rejectReason ?? null,
      updatedAt: new Date(),
    } });
}

export async function listPaperOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paperOrders).where(eq(paperOrders.userId, userId)).orderBy(desc(paperOrders.createdAt)).limit(100);
}

/** Append-only history for one order. */
export async function getOrderLedger(userId: number, orderId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(executionLedger)
    .where(and(eq(executionLedger.userId, userId), eq(executionLedger.orderId, orderId)))
    .orderBy(asc(executionLedger.seq));
}

/** Rotation: atomically replace credential material for an existing key. */
export async function updatePlatformApiKeyMaterial(
  userId: number,
  keyId: string,
  material: { apiKeyEncrypted: string; secretEncrypted: string; keyPrefix: string },
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable; refusing to rotate key (fail closed).");
  await db.update(platformApiKeys)
    .set({ ...material, state: "testing", updatedAt: new Date() })
    .where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId)));
  return getPlatformApiKey(userId, keyId);
}

/**
 * Live-order idempotency lookup: returns the earliest recorded outcome for a
 * caller-supplied idempotency key among live-mode ledger events, or null.
 */
export async function getLiveOrderByIdempotencyKey(
  userId: number,
  idempotencyKey: string,
): Promise<{ orderId: number; status: string; outcome: Record<string, unknown> } | null> {
  const db = await getDb();
  if (!db) return null; // no DB ⇒ no recorded history; caller proceeds through normal gates
  const rows = await db.select().from(executionLedger)
    .where(and(eq(executionLedger.userId, userId), eq(executionLedger.idempotencyKey, idempotencyKey), eq(executionLedger.executionMode, "live")))
    .orderBy(desc(executionLedger.seq))
    .limit(10);
  // Prefer the latest terminal/outcome-bearing event (filled/rejected) for this key.
  for (const row of rows.reverse()) {
    if (row.eventType === "submitted") continue;
    const outcome = (row.payload?.outcome ?? {}) as Record<string, unknown>;
    if (outcome.orderId != null) {
      return { orderId: Number(outcome.orderId), status: String(outcome.status ?? row.eventType), outcome };
    }
  }
  // A submission may be recorded without an outcome yet (crash window): treat as duplicate-in-flight.
  const submitted = rows.find((r) => r.eventType === "submitted");
  if (submitted) {
    return { orderId: 0, status: "submitted-unknown-outcome", outcome: {} };
  }
  return null;
}

// ─── Per-order owner approvals (Stage 5) ───────────────────────────────────

export async function recordLiveOrderApproval(userId: number, args: {
  orderHash: string;
  idempotencyKey: string;
  approvedBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable; refusing to record approval (fail closed).");
  await db.insert(liveOrderApprovals).values({ userId, ...args });
}

/**
 * Consume a fresh, unconsumed approval for the exact order hash. Returns null
 * when no matching unconsumed approval exists within the freshness window.
 */
export async function consumeLiveOrderApproval(userId: number, orderHash: string, maxAgeMs = 10 * 60_000): Promise<boolean> {
  const db = await getDb();
  if (!db) return false; // fail closed
  const rows = await db.select().from(liveOrderApprovals)
    .where(and(eq(liveOrderApprovals.userId, userId), eq(liveOrderApprovals.orderHash, orderHash)))
    .orderBy(desc(liveOrderApprovals.createdAt))
    .limit(1);
  const approval = rows[0];
  if (!approval || approval.consumedAt) return false; // already used for its one execution
  if (Date.now() - new Date(approval.createdAt).getTime() > maxAgeMs) return false; // stale approval
  await db.update(liveOrderApprovals)
    .set({ consumedAt: new Date() })
    .where(eq(liveOrderApprovals.id, approval.id));
  return true;
}
