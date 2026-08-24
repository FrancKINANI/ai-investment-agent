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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
