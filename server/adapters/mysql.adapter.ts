/**
 * MySQL Adapter
 * 
 * Wraps the existing MySQL database functions to implement the DatabaseAdapter interface.
 * This adapter is used when DATABASE_DRIVER=mysql (default).
 */

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { agentProfiles, agentProposals, agentRuns, authorityControls, liveOrderApprovals, liveOrderIntents, liveDailyRiskBuckets, awarenessRecords, bindingChangeRequests, executionLedger, InsertUser, securityAlerts, paperOrders, platformApiKeys, investmentPolicies, operatorActions, outcomeRecords, strategyEvaluations, strategyLineages, users, venueConnections, walletMandates } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { createCapabilityProvenance } from "@shared/capabilityRegistry";
import { nanoid } from "nanoid";
import { AUTHORITY_STATE_MACHINE_VERSION, AuthorityState, evaluateAuthorityTransition } from "@shared/authorityState";
import type { LedgerEventType } from "@shared/paperExecution";
import type { DatabaseAdapter } from "../db.factory";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
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

export class MysqlAdapter implements DatabaseAdapter {
  driver = "mysql" as const;

  async upsertUser(user: InsertUser): Promise<void> {
    if (!user.openId) throw new Error("User openId is required for upsert");
    const db = await getDb();
    if (!db) return;
    const values: InsertUser = { ...user, lastSignedIn: user.lastSignedIn ?? new Date() };
    if (!values.role && user.openId === ENV.ownerOpenId) values.role = "admin";
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: new Date() },
    });
  }

  async getUserByOpenId(openId: string) {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  }

  async listAgentProfiles(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(agentProfiles).where(eq(agentProfiles.userId, userId));
  }

  async listAgentRuns(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(agentRuns).where(eq(agentRuns.userId, userId)).orderBy(desc(agentRuns.createdAt)).limit(30);
  }

  async createAgentRun(userId: number, run: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(agentRuns).values({ userId, ...run, simulationOnly: run.simulationOnly ?? true });
    const saved = await db.select().from(agentRuns).where(eq(agentRuns.runId, run.runId)).limit(1);
    return saved[0];
  }

  async getInvestmentPolicy(userId: number) {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(investmentPolicies).where(eq(investmentPolicies.userId, userId)).limit(1);
    return result[0] ?? null;
  }

  async saveInvestmentPolicy(userId: number, values: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const current = await this.getInvestmentPolicy(userId);
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
    return this.getInvestmentPolicy(userId);
  }

  async createOperatorAction(userId: number, action: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const { capabilityIds, payload, ...record } = action;
    const provenance = createCapabilityProvenance(capabilityIds ?? []);
    await db.insert(operatorActions).values({ userId, ...record, payload: { ...payload, provenance } });
    const saved = await db.select().from(operatorActions).where(eq(operatorActions.actionId, action.actionId)).limit(1);
    return saved[0];
  }

  async listOperatorActions(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(operatorActions).where(eq(operatorActions.userId, userId)).orderBy(desc(operatorActions.createdAt)).limit(80);
  }

  async createBindingChangeRequest(userId: number, request: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(bindingChangeRequests).values({ userId, ...request, status: "pending", reviewerUserId: null, reviewNote: null, reviewedAt: null });
    const saved = await db.select().from(bindingChangeRequests).where(eq(bindingChangeRequests.requestId, request.requestId)).limit(1);
    return saved[0] ?? null;
  }

  async listBindingChangeRequests(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(bindingChangeRequests).where(eq(bindingChangeRequests.userId, userId)).orderBy(desc(bindingChangeRequests.updatedAt)).limit(40);
  }

  async getBindingChangeRequest(userId: number, requestId: string) {
    const db = await getDb();
    if (!db) return null;
    const saved = await db.select().from(bindingChangeRequests).where(and(eq(bindingChangeRequests.userId, userId), eq(bindingChangeRequests.requestId, requestId))).limit(1);
    return saved[0] ?? null;
  }

  async reviewBindingChangeRequest(userId: number, requestId: string, reviewerUserId: number, status: "approved" | "rejected", reviewNote: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(bindingChangeRequests).set({ status, reviewerUserId, reviewNote, reviewedAt: new Date(), updatedAt: new Date() }).where(and(eq(bindingChangeRequests.userId, userId), eq(bindingChangeRequests.requestId, requestId), eq(bindingChangeRequests.status, "pending")));
    return this.getBindingChangeRequest(userId, requestId);
  }

  async createWalletMandate(userId: number, values: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(walletMandates).values({ userId, ...values });
    const saved = await db.select().from(walletMandates).where(eq(walletMandates.mandateId, values.mandateId)).limit(1);
    return saved[0];
  }

  async listWalletMandates(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(walletMandates).where(eq(walletMandates.userId, userId)).orderBy(desc(walletMandates.updatedAt));
  }

  async updateWalletMandateMode(userId: number, mandateId: string, mode: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(walletMandates).set({ mode: mode as any, status: (mode === "paused" ? "paused" : "active") as any, updatedAt: new Date() }).where(and(eq(walletMandates.userId, userId), eq(walletMandates.mandateId, mandateId)));
    const saved = await db.select().from(walletMandates).where(and(eq(walletMandates.userId, userId), eq(walletMandates.mandateId, mandateId))).limit(1);
    return saved[0] ?? null;
  }

  async createVenueConnection(userId: number, values: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(venueConnections).values({ userId, ...values, credentialRef: values.credentialRef ?? null });
    const saved = await db.select().from(venueConnections).where(eq(venueConnections.connectionId, values.connectionId)).limit(1);
    return saved[0];
  }

  async listVenueConnections(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(venueConnections).where(eq(venueConnections.userId, userId)).orderBy(desc(venueConnections.updatedAt));
  }

  async createAgentProposal(userId: number, values: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(agentProposals).values({ userId, ...values, runId: values.runId ?? null });
    const saved = await db.select().from(agentProposals).where(eq(agentProposals.proposalId, values.proposalId)).limit(1);
    return saved[0];
  }

  async listAgentProposals(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(agentProposals).where(eq(agentProposals.userId, userId)).orderBy(desc(agentProposals.updatedAt)).limit(40);
  }

  async getAgentProposal(userId: number, proposalId: string) {
    const db = await getDb();
    if (!db) return null;
    const saved = await db.select().from(agentProposals).where(and(eq(agentProposals.userId, userId), eq(agentProposals.proposalId, proposalId))).limit(1);
    return saved[0] ?? null;
  }

  async updateAgentProposalStatus(userId: number, proposalId: string, status: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(agentProposals).set({ status: status as any, updatedAt: new Date() }).where(and(eq(agentProposals.userId, userId), eq(agentProposals.proposalId, proposalId)));
    return this.getAgentProposal(userId, proposalId);
  }

  async createAwarenessRecord(userId: number, record: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(awarenessRecords).values({ userId, ...record });
    const saved = await db.select().from(awarenessRecords).where(eq(awarenessRecords.userId, userId)).orderBy(desc(awarenessRecords.createdAt)).limit(1);
    return saved[0];
  }

  async listAwarenessRecords(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(awarenessRecords).where(eq(awarenessRecords.userId, userId)).orderBy(desc(awarenessRecords.createdAt)).limit(80);
  }

  async listStrategyLineages(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(strategyLineages).where(eq(strategyLineages.userId, userId)).orderBy(desc(strategyLineages.updatedAt)).limit(80);
  }

  async createStrategyLineage(userId: number, record: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(strategyLineages).values({ userId, ...record, parentVersion: record.parentVersion ?? null });
    const saved = await db.select().from(strategyLineages).where(eq(strategyLineages.userId, userId)).orderBy(desc(strategyLineages.createdAt)).limit(1);
    return saved[0];
  }

  async listStrategyEvaluations(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(strategyEvaluations).where(eq(strategyEvaluations.userId, userId)).orderBy(desc(strategyEvaluations.createdAt)).limit(80);
  }

  async createStrategyEvaluation(userId: number, record: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(strategyEvaluations).values({ userId, ...record });
    const saved = await db.select().from(strategyEvaluations).where(eq(strategyEvaluations.userId, userId)).orderBy(desc(strategyEvaluations.createdAt)).limit(1);
    return saved[0];
  }

  async listOutcomeRecords(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(outcomeRecords).where(eq(outcomeRecords.userId, userId)).orderBy(desc(outcomeRecords.updatedAt)).limit(80);
  }

  async createOutcomeRecord(userId: number, record: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(outcomeRecords).values({ userId, ...record, runId: record.runId ?? null, realizedBps: record.realizedBps ?? null });
    const saved = await db.select().from(outcomeRecords).where(eq(outcomeRecords.userId, userId)).orderBy(desc(outcomeRecords.createdAt)).limit(1);
    return saved[0];
  }

  async createSecurityAlert(userId: number, alert: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(securityAlerts).values({ userId, ...alert, actionRef: alert.actionRef ?? null });
    const saved = await db.select().from(securityAlerts).where(eq(securityAlerts.alertId, alert.alertId)).limit(1);
    return saved[0];
  }

  async listSecurityAlerts(userId: number) {
    const db = await getDb();
    if (!db) return [];
    try {
      return await db.select().from(securityAlerts).where(eq(securityAlerts.userId, userId)).orderBy(desc(securityAlerts.createdAt)).limit(100);
    } catch (error) {
      console.warn("[Security alerts] Alert table is unavailable; returning an empty owner-scoped result.");
      return [];
    }
  }

  async acknowledgeSecurityAlert(userId: number, alertId: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(securityAlerts).set({ acknowledged: true, updatedAt: new Date() }).where(and(eq(securityAlerts.userId, userId), eq(securityAlerts.alertId, alertId)));
    const saved = await db.select().from(securityAlerts).where(and(eq(securityAlerts.userId, userId), eq(securityAlerts.alertId, alertId))).limit(1);
    return saved[0] ?? null;
  }

  async countUnacknowledgedAlerts(userId: number) {
    const db = await getDb();
    if (!db) return 0;
    try {
      const result = await db.select().from(securityAlerts).where(and(eq(securityAlerts.userId, userId), eq(securityAlerts.acknowledged, false)));
      return result.length;
    } catch {
      return 0;
    }
  }

  async createPlatformApiKey(userId: number, key: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(platformApiKeys).values({
      userId,
      ...key,
      state: "testing",
      maxOrderUsd: key.maxOrderUsd ?? null,
      allocatedCapitalUsd: key.allocatedCapitalUsd ?? null,
      dailyTradeLimit: key.dailyTradeLimit ?? null,
    });
    const saved = await db.select().from(platformApiKeys).where(eq(platformApiKeys.keyId, key.keyId)).limit(1);
    return saved[0];
  }

  async listPlatformApiKeys(userId: number) {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(platformApiKeys).where(eq(platformApiKeys.userId, userId)).orderBy(desc(platformApiKeys.createdAt));
  }

  async getPlatformApiKey(userId: number, keyId: string) {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(platformApiKeys).where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId))).limit(1);
    return result[0] ?? null;
  }

  async updatePlatformApiKeyState(userId: number, keyId: string, state: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(platformApiKeys).set({ state: state as any, updatedAt: new Date() }).where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId)));
    return this.getPlatformApiKey(userId, keyId);
  }

  async updatePlatformApiKeyLimits(userId: number, keyId: string, limits: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(platformApiKeys).set({ ...limits, updatedAt: new Date() }).where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId)));
    return this.getPlatformApiKey(userId, keyId);
  }

  async deletePlatformApiKey(userId: number, keyId: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await this.getPlatformApiKey(userId, keyId);
    if (!existing) return null;
    await db.delete(platformApiKeys).where(and(eq(platformApiKeys.userId, userId), eq(platformApiKeys.keyId, keyId)));
    return existing;
  }

  async getAuthorityState(userId: number): Promise<AuthorityState> {
    const db = await getDb();
    if (!db) return "disabled";
    const result = await db.select().from(authorityControls).where(eq(authorityControls.userId, userId)).limit(1);
    return AuthorityState.parse(result[0]?.state ?? "disabled");
  }

  async changeAuthorityState(userId: number, to: AuthorityState, initiatedBy: string, reason: string) {
    const db = await getDb();
    if (!db) return { ok: false, reason: "Database unavailable; refusing authority transition (fail closed)." };
    const from = await this.getAuthorityState(userId);
    const validation = evaluateAuthorityTransition({ from, to, initiatedBy, reason });
    if (!validation.allowed) return { ok: false, reason: validation.reason };

    await db
      .insert(authorityControls)
      .values({ userId, state: to, machineVersion: AUTHORITY_STATE_MACHINE_VERSION, updatedBy: initiatedBy, reason })
      .onDuplicateKeyUpdate({
        set: { state: to, machineVersion: AUTHORITY_STATE_MACHINE_VERSION, updatedBy: initiatedBy, reason, updatedAt: new Date() },
      });

    await this.createOperatorAction(userId, {
      actionId: nanoid(),
      kind: "authority_changed",
      status: "success",
      subject: `Authority ${from} → ${to}`,
      detail: `Owner-initiated authority transition (${initiatedBy}): ${reason}`,
      payload: { from, to, initiatedBy, machineVersion: AUTHORITY_STATE_MACHINE_VERSION },
    });

    return { ok: true, from, to };
  }

  async getPaperOrderByIdempotencyKey(userId: number, idempotencyKey: string) {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(paperOrders)
      .where(and(eq(paperOrders.userId, userId), eq(paperOrders.idempotencyKey, idempotencyKey)))
      .limit(1);
    return rows[0] ?? null;
  }

  async appendLedgerEvent(userId: number, event: any) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable; refusing to write execution event (fail closed).");
    await db.insert(executionLedger).values({ userId, ...event, eventId: event.eventId ?? nanoid() });
  }

  async upsertPaperOrderProjection(userId: number, order: any) {
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

  async reserveLiveOrderIntent(userId: number, idempotencyKey: string, orderHash: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    try {
      await db.insert(liveOrderIntents).values({ userId, idempotencyKey, orderHash, status: "reserved" });
      return true;
    } catch (error) {
      const existing = await db.select().from(liveOrderIntents)
        .where(and(eq(liveOrderIntents.userId, userId), eq(liveOrderIntents.idempotencyKey, idempotencyKey)))
        .limit(1);
      if (existing[0]) return false;
      throw error;
    }
  }

  async updateLiveOrderIntentStatus(userId: number, idempotencyKey: string, status: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(liveOrderIntents).set({ status: status as any, updatedAt: new Date() })
      .where(and(eq(liveOrderIntents.userId, userId), eq(liveOrderIntents.idempotencyKey, idempotencyKey)));
  }

  async reserveDailyRisk(userId: number, dayKey: string, notionalCents: number, tradeCount: number = 1) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(liveDailyRiskBuckets).values({ userId, dayKey, reservedNotionalCents: 0, reservedTradeCount: 0 })
      .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
    await db.update(liveDailyRiskBuckets)
      .set({
        reservedNotionalCents: sql`${liveDailyRiskBuckets.reservedNotionalCents} + ${notionalCents}`,
        reservedTradeCount: sql`${liveDailyRiskBuckets.reservedTradeCount} + ${tradeCount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(liveDailyRiskBuckets.userId, userId), eq(liveDailyRiskBuckets.dayKey, dayKey)));
  }

  async createLiveOrderApproval(userId: number, orderHash: string, idempotencyKey: string, approvedBy: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.insert(liveOrderApprovals).values({ userId, orderHash, idempotencyKey, approvedBy });
    const saved = await db.select().from(liveOrderApprovals).where(and(eq(liveOrderApprovals.userId, userId), eq(liveOrderApprovals.orderHash, orderHash))).limit(1);
    return saved[0];
  }

  async consumeLiveOrderApproval(userId: number, orderHash: string) {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(liveOrderApprovals).set({ consumedAt: new Date() }).where(and(eq(liveOrderApprovals.userId, userId), eq(liveOrderApprovals.orderHash, orderHash)));
  }
}
