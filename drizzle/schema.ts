import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core identity table managed by the Manus OAuth workflow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** User-owned logical agents. Provider credentials are intentionally never stored here. */
export const agentProfiles = mysqlTable("agentProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  role: mysqlEnum("role", ["research", "onchain", "risk", "allocator", "supervisor"]).notNull(),
  provider: mysqlEnum("provider", ["openai", "anthropic", "google", "custom"]).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  toolScopes: json("toolScopes").$type<string[]>().notNull(),
  state: mysqlEnum("state", ["active", "paused", "review"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Evidence trail for simulation runs. No private keys, raw prompts, or provider secrets belong here. */
export const agentRuns = mysqlTable("agentRuns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  runId: varchar("runId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["passed", "review", "blocked"]).notNull(),
  policyResult: mysqlEnum("policyResult", ["pass", "review", "block"]).notNull(),
  simulationOnly: boolean("simulationOnly").default(true).notNull(),
  summary: text("summary").notNull(),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Four-layer operational awareness: action, justification, outcome, and evolution. */
export const awarenessRecords = mysqlTable("awarenessRecords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  layer: mysqlEnum("layer", ["action", "justification", "result", "evolutionary"]).notNull(),
  subject: varchar("subject", { length: 160 }).notNull(),
  runId: varchar("runId", { length: 64 }),
  evidence: json("evidence").$type<string[]>().notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** A versioned strategy family; promotion is deliberately limited to research/simulation/decision states. */
export const strategyLineages = mysqlTable("strategyLineages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lineageId: varchar("lineageId", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  stage: mysqlEnum("stage", ["research", "simulation", "decision", "retired"]).default("research").notNull(),
  generation: int("generation").default(1).notNull(),
  parentVersion: varchar("parentVersion", { length: 64 }),
  scores: json("scores").$type<Record<string, number>>().notNull(),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Hard-gate evaluations and supervised promotion evidence for a strategy version. */
export const strategyEvaluations = mysqlTable("strategyEvaluations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lineageId: varchar("lineageId", { length: 64 }).notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  gateResult: mysqlEnum("gateResult", ["pass", "review", "block"]).notNull(),
  simulationPassed: boolean("simulationPassed").default(false).notNull(),
  coverage: int("coverage").default(0).notNull(),
  complexityPenalty: int("complexityPenalty").default(0).notNull(),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Outcome-aware counterpart to a paper run or lineage version; values are recorded in basis points. */
export const outcomeRecords = mysqlTable("outcomeRecords", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lineageId: varchar("lineageId", { length: 64 }).notNull(),
  runId: varchar("runId", { length: 64 }),
  expectedBps: int("expectedBps").notNull(),
  realizedBps: int("realizedBps"),
  attribution: json("attribution").$type<Record<string, number>>().notNull(),
  deviation: mysqlEnum("deviation", ["on_track", "underperforming", "outperforming", "inconclusive"]).default("inconclusive").notNull(),
  narrative: text("narrative").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Owner-defined Investment Policy Statement. Limits use basis points; execution remains simulation-only in this phase. */
export const investmentPolicies = mysqlTable("investmentPolicies", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  version: int("version").default(1).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  maxConcentrationBps: int("maxConcentrationBps").notNull(),
  minReserveBps: int("minReserveBps").notNull(),
  maxTransactionBps: int("maxTransactionBps").notNull(),
  dailyMandateBps: int("dailyMandateBps").notNull(),
  allowedAssets: json("allowedAssets").$type<string[]>().notNull(),
  executionMode: mysqlEnum("executionMode", ["simulation", "read_only"]).default("simulation").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Immutable operator-originated actions. This is distinct from the AI awareness journal. */
export const operatorActions = mysqlTable("operatorActions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(),
  kind: mysqlEnum("kind", ["policy_updated", "simulation_started", "simulation_blocked", "onchain_viewed", "scope_checked", "outcome_recorded", "promotion_changed"]).notNull(),
  status: mysqlEnum("status", ["success", "review", "blocked"]).notNull(),
  subject: varchar("subject", { length: 160 }).notNull(),
  detail: text("detail").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AwarenessRecord = typeof awarenessRecords.$inferSelect;
export type StrategyLineage = typeof strategyLineages.$inferSelect;
export type StrategyEvaluation = typeof strategyEvaluations.$inferSelect;
export type OutcomeRecord = typeof outcomeRecords.$inferSelect;
export type InvestmentPolicy = typeof investmentPolicies.$inferSelect;
export type OperatorAction = typeof operatorActions.$inferSelect;
