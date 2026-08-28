/**
 * Database Factory
 * 
 * Selects the appropriate database driver based on DATABASE_DRIVER environment variable.
 * - "mysql" (default): Uses MySQL/TiDB with mysql2 driver
 * - "postgresql": Uses PostgreSQL with pg driver
 * 
 * This allows gradual migration from MySQL to PostgreSQL without breaking existing code.
 */

import { and, asc, desc, eq, isNull, sql, SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AUTHORITY_STATE_MACHINE_VERSION, AuthorityState, evaluateAuthorityTransition } from "@shared/authorityState";
import type { LedgerEventType } from "@shared/paperExecution";
import { createCapabilityProvenance } from "@shared/capabilityRegistry";
import { ENV } from "./_core/env";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DatabaseDriver = "mysql" | "postgresql";

export interface DatabaseAdapter {
  driver: DatabaseDriver;
  
  // User operations
  upsertUser(user: any): Promise<void>;
  getUserByOpenId(openId: string): Promise<any>;
  
  // Agent operations
  listAgentProfiles(userId: number): Promise<any[]>;
  listAgentRuns(userId: number): Promise<any[]>;
  createAgentRun(userId: number, run: any): Promise<any>;
  
  // Policy operations
  getInvestmentPolicy(userId: number): Promise<any>;
  saveInvestmentPolicy(userId: number, values: any): Promise<any>;
  
  // Operator actions
  createOperatorAction(userId: number, action: any): Promise<any>;
  listOperatorActions(userId: number): Promise<any[]>;
  
  // Binding change requests
  createBindingChangeRequest(userId: number, request: any): Promise<any>;
  listBindingChangeRequests(userId: number): Promise<any[]>;
  getBindingChangeRequest(userId: number, requestId: string): Promise<any>;
  reviewBindingChangeRequest(userId: number, requestId: string, reviewerUserId: number, status: "approved" | "rejected", reviewNote: string): Promise<any>;
  
  // Wallet mandates
  createWalletMandate(userId: number, values: any): Promise<any>;
  listWalletMandates(userId: number): Promise<any[]>;
  updateWalletMandateMode(userId: number, mandateId: string, mode: string): Promise<any>;
  
  // Venue connections
  createVenueConnection(userId: number, values: any): Promise<any>;
  listVenueConnections(userId: number): Promise<any[]>;
  
  // Agent proposals
  createAgentProposal(userId: number, values: any): Promise<any>;
  listAgentProposals(userId: number): Promise<any[]>;
  getAgentProposal(userId: number, proposalId: string): Promise<any>;
  updateAgentProposalStatus(userId: number, proposalId: string, status: string): Promise<any>;
  
  // Awareness records
  createAwarenessRecord(userId: number, record: any): Promise<any>;
  listAwarenessRecords(userId: number): Promise<any[]>;
  
  // Strategy lineages
  listStrategyLineages(userId: number): Promise<any[]>;
  createStrategyLineage(userId: number, record: any): Promise<any>;
  
  // Strategy evaluations
  listStrategyEvaluations(userId: number): Promise<any[]>;
  createStrategyEvaluation(userId: number, record: any): Promise<any>;
  
  // Outcome records
  listOutcomeRecords(userId: number): Promise<any[]>;
  createOutcomeRecord(userId: number, record: any): Promise<any>;
  
  // Security alerts
  createSecurityAlert(userId: number, alert: any): Promise<any>;
  listSecurityAlerts(userId: number): Promise<any[]>;
  acknowledgeSecurityAlert(userId: number, alertId: string): Promise<any>;
  countUnacknowledgedAlerts(userId: number): Promise<number>;
  
  // Platform API keys
  createPlatformApiKey(userId: number, key: any): Promise<any>;
  listPlatformApiKeys(userId: number): Promise<any[]>;
  getPlatformApiKey(userId: number, keyId: string): Promise<any>;
  updatePlatformApiKeyState(userId: number, keyId: string, state: string): Promise<any>;
  updatePlatformApiKeyLimits(userId: number, keyId: string, limits: any): Promise<any>;
  deletePlatformApiKey(userId: number, keyId: string): Promise<any>;
  
  // Authority control
  getAuthorityState(userId: number): Promise<AuthorityState>;
  changeAuthorityState(userId: number, to: AuthorityState, initiatedBy: string, reason: string): Promise<any>;
  
  // Paper execution
  getPaperOrderByIdempotencyKey(userId: number, idempotencyKey: string): Promise<any>;
  appendLedgerEvent(userId: number, event: any): Promise<void>;
  upsertPaperOrderProjection(userId: number, order: any): Promise<void>;
  
  // Live order intents
  reserveLiveOrderIntent(userId: number, idempotencyKey: string, orderHash: string): Promise<boolean>;
  updateLiveOrderIntentStatus(userId: number, idempotencyKey: string, status: string): Promise<void>;
  
  // Live daily risk buckets
  reserveDailyRisk(userId: number, dayKey: string, notionalCents: number, tradeCount?: number): Promise<void>;
  
  // Live order approvals
  createLiveOrderApproval(userId: number, orderHash: string, idempotencyKey: string, approvedBy: string): Promise<any>;
  consumeLiveOrderApproval(userId: number, orderHash: string): Promise<void>;
}

// ─── Driver Selection ───────────────────────────────────────────────────────

let _adapter: DatabaseAdapter | null = null;

export async function getDatabaseAdapter(): Promise<DatabaseAdapter> {
  if (_adapter) return _adapter;
  
  const driver: DatabaseDriver = (process.env.DATABASE_DRIVER as DatabaseDriver) || "mysql";
  
  if (driver === "postgresql") {
    const { PostgresAdapter } = await import("./adapters/postgres.adapter");
    _adapter = new PostgresAdapter();
  } else {
    const { MysqlAdapter } = await import("./adapters/mysql.adapter");
    _adapter = new MysqlAdapter();
  }
  
  console.log(`[Database] Using ${driver} driver`);
  return _adapter;
}

export function resetDatabaseAdapter(): void {
  _adapter = null;
}

// ─── Convenience Functions (delegate to adapter) ────────────────────────────

export async function upsertUser(user: any): Promise<void> {
  const adapter = await getDatabaseAdapter();
  return adapter.upsertUser(user);
}

export async function getUserByOpenId(openId: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.getUserByOpenId(openId);
}

export async function listAgentProfiles(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listAgentProfiles(userId);
}

export async function listAgentRuns(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listAgentRuns(userId);
}

export async function createAgentRun(userId: number, run: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createAgentRun(userId, run);
}

export async function getInvestmentPolicy(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.getInvestmentPolicy(userId);
}

export async function saveInvestmentPolicy(userId: number, values: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.saveInvestmentPolicy(userId, values);
}

export async function createOperatorAction(userId: number, action: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createOperatorAction(userId, action);
}

export async function listOperatorActions(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listOperatorActions(userId);
}

export async function createBindingChangeRequest(userId: number, request: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createBindingChangeRequest(userId, request);
}

export async function listBindingChangeRequests(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listBindingChangeRequests(userId);
}

export async function getBindingChangeRequest(userId: number, requestId: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.getBindingChangeRequest(userId, requestId);
}

export async function reviewBindingChangeRequest(userId: number, requestId: string, reviewerUserId: number, status: "approved" | "rejected", reviewNote: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.reviewBindingChangeRequest(userId, requestId, reviewerUserId, status, reviewNote);
}

export async function createWalletMandate(userId: number, values: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createWalletMandate(userId, values);
}

export async function listWalletMandates(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listWalletMandates(userId);
}

export async function updateWalletMandateMode(userId: number, mandateId: string, mode: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.updateWalletMandateMode(userId, mandateId, mode);
}

export async function createVenueConnection(userId: number, values: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createVenueConnection(userId, values);
}

export async function listVenueConnections(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listVenueConnections(userId);
}

export async function createAgentProposal(userId: number, values: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createAgentProposal(userId, values);
}

export async function listAgentProposals(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listAgentProposals(userId);
}

export async function getAgentProposal(userId: number, proposalId: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.getAgentProposal(userId, proposalId);
}

export async function updateAgentProposalStatus(userId: number, proposalId: string, status: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.updateAgentProposalStatus(userId, proposalId, status);
}

export async function createAwarenessRecord(userId: number, record: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createAwarenessRecord(userId, record);
}

export async function listAwarenessRecords(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listAwarenessRecords(userId);
}

export async function listStrategyLineages(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listStrategyLineages(userId);
}

export async function createStrategyLineage(userId: number, record: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createStrategyLineage(userId, record);
}

export async function listStrategyEvaluations(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listStrategyEvaluations(userId);
}

export async function createStrategyEvaluation(userId: number, record: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createStrategyEvaluation(userId, record);
}

export async function listOutcomeRecords(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listOutcomeRecords(userId);
}

export async function createOutcomeRecord(userId: number, record: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createOutcomeRecord(userId, record);
}

export async function createSecurityAlert(userId: number, alert: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createSecurityAlert(userId, alert);
}

export async function listSecurityAlerts(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listSecurityAlerts(userId);
}

export async function acknowledgeSecurityAlert(userId: number, alertId: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.acknowledgeSecurityAlert(userId, alertId);
}

export async function countUnacknowledgedAlerts(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.countUnacknowledgedAlerts(userId);
}

export async function createPlatformApiKey(userId: number, key: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.createPlatformApiKey(userId, key);
}

export async function listPlatformApiKeys(userId: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.listPlatformApiKeys(userId);
}

export async function getPlatformApiKey(userId: number, keyId: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.getPlatformApiKey(userId, keyId);
}

export async function updatePlatformApiKeyState(userId: number, keyId: string, state: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.updatePlatformApiKeyState(userId, keyId, state);
}

export async function updatePlatformApiKeyLimits(userId: number, keyId: string, limits: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.updatePlatformApiKeyLimits(userId, keyId, limits);
}

export async function deletePlatformApiKey(userId: number, keyId: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.deletePlatformApiKey(userId, keyId);
}

export async function getAuthorityState(userId: number): Promise<AuthorityState> {
  const adapter = await getDatabaseAdapter();
  return adapter.getAuthorityState(userId);
}

export async function changeAuthorityState(userId: number, to: AuthorityState, initiatedBy: string, reason: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.changeAuthorityState(userId, to, initiatedBy, reason);
}

export async function getPaperOrderByIdempotencyKey(userId: number, idempotencyKey: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.getPaperOrderByIdempotencyKey(userId, idempotencyKey);
}

export async function appendLedgerEvent(userId: number, event: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.appendLedgerEvent(userId, event);
}

export async function upsertPaperOrderProjection(userId: number, order: any) {
  const adapter = await getDatabaseAdapter();
  return adapter.upsertPaperOrderProjection(userId, order);
}

export async function reserveLiveOrderIntent(userId: number, idempotencyKey: string, orderHash: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.reserveLiveOrderIntent(userId, idempotencyKey, orderHash);
}

export async function updateLiveOrderIntentStatus(userId: number, idempotencyKey: string, status: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.updateLiveOrderIntentStatus(userId, idempotencyKey, status);
}

export async function reserveDailyRisk(userId: number, dayKey: string, notionalCents: number, tradeCount?: number) {
  const adapter = await getDatabaseAdapter();
  return adapter.reserveDailyRisk(userId, dayKey, notionalCents, tradeCount);
}

export async function createLiveOrderApproval(userId: number, orderHash: string, idempotencyKey: string, approvedBy: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.createLiveOrderApproval(userId, orderHash, idempotencyKey, approvedBy);
}

export async function consumeLiveOrderApproval(userId: number, orderHash: string) {
  const adapter = await getDatabaseAdapter();
  return adapter.consumeLiveOrderApproval(userId, orderHash);
}
