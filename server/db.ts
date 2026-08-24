import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { agentProfiles, agentRuns, InsertUser, investmentPolicies, operatorActions, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(agentRuns).values({ userId, ...run, simulationOnly: true });
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
  if (!db) return undefined;
  const result = await db.select().from(investmentPolicies).where(eq(investmentPolicies.userId, userId)).limit(1);
  return result[0];
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
  kind: "policy_updated" | "simulation_started" | "simulation_blocked" | "onchain_viewed" | "scope_checked" | "outcome_recorded" | "promotion_changed";
  status: "success" | "review" | "blocked";
  subject: string;
  detail: string;
  payload: Record<string, unknown>;
};

export async function createOperatorAction(userId: number, action: OperatorActionInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(operatorActions).values({ userId, ...action });
  const saved = await db.select().from(operatorActions).where(eq(operatorActions.actionId, action.actionId)).limit(1);
  return saved[0];
}

export async function listOperatorActions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operatorActions).where(eq(operatorActions.userId, userId)).orderBy(desc(operatorActions.createdAt)).limit(80);
}
