import { bigint, boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  attribution: json("attribution").$type<Record<string, string | number | boolean | null>>().notNull(),
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

/** A wallet role and its owner-defined venue mandate. No key or secret is stored in this table. */
export const walletMandates = mysqlTable("walletMandates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mandateId: varchar("mandateId", { length: 64 }).notNull().unique(),
  walletRole: mysqlEnum("walletRole", ["trading", "investment"]).notNull(),
  venue: mysqlEnum("venue", ["binance", "evm", "polymarket"]).notNull(),
  mode: mysqlEnum("mode", ["simulation", "armed", "real", "paused"]).default("simulation").notNull(),
  status: mysqlEnum("status", ["active", "paused", "disconnected"]).default("active").notNull(),
  allowedAssets: json("allowedAssets").$type<string[]>().notNull(),
  maxOrderBps: int("maxOrderBps").notNull(),
  dailyCapBps: int("dailyCapBps").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** A connection record represents adapter state only; credential material remains server-side in secrets. */
export const venueConnections = mysqlTable("venueConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  connectionId: varchar("connectionId", { length: 64 }).notNull().unique(),
  venue: mysqlEnum("venue", ["binance", "evm", "polymarket"]).notNull(),
  state: mysqlEnum("state", ["disconnected", "simulation", "armed", "real"]).default("disconnected").notNull(),
  capabilities: json("capabilities").$type<string[]>().notNull(),
  credentialRef: varchar("credentialRef", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** A proposal can be reviewed, rejected, approved for simulation, or settled in a simulated adapter. */
export const agentProposals = mysqlTable("agentProposals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  proposalId: varchar("proposalId", { length: 64 }).notNull().unique(),
  runId: varchar("runId", { length: 64 }),
  walletRole: mysqlEnum("walletRole", ["trading", "investment"]).notNull(),
  venue: mysqlEnum("venue", ["binance", "evm", "polymarket"]).notNull(),
  status: mysqlEnum("status", ["review", "approved", "rejected", "simulated", "blocked"]).default("review").notNull(),
  policyResult: mysqlEnum("policyResult", ["pass", "review", "block"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  rationale: text("rationale").notNull(),
  action: json("action").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Configurable protected core roles and bounded optional subagents; no credentials or execution scopes are stored here. */
export const agentNodes = mysqlTable("agentNodes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  agentId: varchar("agentId", { length: 64 }).notNull().unique(),
  roleKey: varchar("roleKey", { length: 64 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  parentAgentId: varchar("parentAgentId", { length: 64 }),
  protectedRole: boolean("protectedRole").default(false).notNull(),
  provider: mysqlEnum("provider", ["openai", "anthropic", "google", "custom"]).notNull(),
  model: varchar("model", { length: 160 }).notNull(),
  toolScopes: json("toolScopes").$type<string[]>().notNull(),
  state: mysqlEnum("state", ["active", "paused", "retired", "review"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Owner-visible supervisor conversations. System prompts and credentials are never persisted. */
export const agentConversations = mysqlTable("agentConversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  threadId: varchar("threadId", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const agentMessages = mysqlTable("agentMessages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  threadId: varchar("threadId", { length: 64 }).notNull(),
  actor: mysqlEnum("actor", ["owner", "supervisor", "agent", "system"]).notNull(),
  agentId: varchar("agentId", { length: 64 }),
  content: text("content").notNull(),
  /** Research-note completeness score (0–100), never a performance or return forecast. */
  confidence: int("confidence"),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Compact evolution entries explain the agent graph without exposing raw hidden reasoning. */
export const agentEvolutionEvents = mysqlTable("agentEvolutionEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  threadId: varchar("threadId", { length: 64 }),
  agentId: varchar("agentId", { length: 64 }),
  state: mysqlEnum("state", ["delegated", "working", "completed", "blocked", "created", "retired"]).notNull(),
  summary: text("summary").notNull(),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Owner-defined research universe. Initial discovery is limited to watchlist items. */
export const watchlists = mysqlTable("watchlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  watchlistId: varchar("watchlistId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  criteria: json("criteria").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const watchlistItems = mysqlTable("watchlistItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  itemId: varchar("itemId", { length: 64 }).notNull().unique(),
  watchlistId: varchar("watchlistId", { length: 64 }).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  address: varchar("address", { length: 64 }),
  symbol: varchar("symbol", { length: 32 }),
  chain: varchar("chain", { length: 32 }),
  status: mysqlEnum("status", ["watching", "candidate", "review", "blocked"]).default("watching").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Scheduler records stay disabled until the owner enables them on a deployed site. */
export const discoverySchedules = mysqlTable("discoverySchedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  scheduleId: varchar("scheduleId", { length: 64 }).notNull().unique(),
  cadence: mysqlEnum("cadence", ["daily", "six_hour"]).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const discoveryFindings = mysqlTable("discoveryFindings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  findingId: varchar("findingId", { length: 64 }).notNull().unique(),
  scheduleId: varchar("scheduleId", { length: 64 }),
  watchlistItemId: varchar("watchlistItemId", { length: 64 }),
  score: int("score").notNull(),
  confidence: mysqlEnum("confidence", ["low", "medium", "high"]).notNull(),
  status: mysqlEnum("status", ["watching", "candidate", "review", "blocked"]).notNull(),
  summary: text("summary").notNull(),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Immutable operator-originated actions. This is distinct from the AI awareness journal. */
/** Owner-controlled real-mode authority state (Ledgerline v1.1). Defaults to disabled; fail closed. */
export const authorityControls = mysqlTable("authorityControls", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  state: mysqlEnum("state", [
    "disabled", "sandbox-only", "read-only-live",
    "approval-required-live", "limited-live", "paused", "revoked",
  ]).default("disabled").notNull(),
  machineVersion: int("machineVersion").default(1).notNull(),
  updatedBy: varchar("updatedBy", { length: 120 }),
  reason: varchar("reason", { length: 800 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const operatorActions = mysqlTable("operatorActions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(),
  kind: mysqlEnum("kind", [
    "policy_updated", "simulation_started", "simulation_blocked", "onchain_viewed",
    "scope_checked", "outcome_recorded", "promotion_changed", "research_completed",
    "mandate_created", "mandate_mode_changed", "venue_configured", "proposal_created",
    "proposal_approved", "proposal_rejected", "simulation_settled", "agent_configured",
    "subagent_created", "subagent_retired", "chat_message", "watchlist_created",
    "watchlist_updated", "discovery_schedule_configured", "discovery_completed",
    "platform_key_added", "platform_key_removed", "platform_key_disabled",
    "wallet_connected", "wallet_disconnected", "mode_changed",
    "authority_changed",
    "alert_created", "alert_acknowledged", "owner_note",
  ]).notNull(),
  status: mysqlEnum("status", ["success", "review", "blocked"]).notNull(),
  subject: varchar("subject", { length: 160 }).notNull(),
  detail: text("detail").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** A validated configuration change proposal; approval never mutates the active manifest in Phase 0. */
export const bindingChangeRequests = mysqlTable("bindingChangeRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  requestId: varchar("requestId", { length: 64 }).notNull().unique(),
  capabilityId: varchar("capabilityId", { length: 120 }).notNull(),
  roleKeys: json("roleKeys").$type<string[]>().notNull(),
  permission: mysqlEnum("permission", ["research-only", "simulation-only"]).notNull(),
  rationale: text("rationale").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewerUserId: int("reviewerUserId"),
  reviewNote: text("reviewNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Security alerts: critical, warning, info. All alerts are structured, auditable, and linkable to the Decision Journal. */
export const securityAlerts = mysqlTable("securityAlerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  alertId: varchar("alertId", { length: 64 }).notNull().unique(),
  level: mysqlEnum("level", ["critical", "warning", "info"]).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  detail: text("detail").notNull(),
  actionRef: varchar("actionRef", { length: 64 }),
  acknowledged: boolean("acknowledged").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Platform API key records. API key and secret are stored encrypted; the key prefix is kept for identification only. */
export const platformApiKeys = mysqlTable("platformApiKeys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  keyId: varchar("keyId", { length: 64 }).notNull().unique(),
  platform: mysqlEnum("platform", ["binance", "okx", "coinbase", "kraken", "polymarket"]).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 16 }).notNull(),
  apiKeyEncrypted: varchar("apiKeyEncrypted", { length: 512 }).notNull(),
  secretEncrypted: varchar("secretEncrypted", { length: 512 }).notNull(),
  permissions: json("permissions").$type<string[]>().notNull(),
  hasWithdrawPermission: boolean("hasWithdrawPermission").default(false).notNull(),
  // A newly ingested credential must pass a signed read-only verification
  // before it can be used by any signed venue request.
  state: mysqlEnum("state", ["active", "disabled", "testing"]).default("testing").notNull(),
  maxOrderUsd: int("maxOrderUsd"),
  allocatedCapitalUsd: int("allocatedCapitalUsd"),
  dailyTradeLimit: int("dailyTradeLimit"),
  lastTestedAt: timestamp("lastTestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export type WalletMandate = typeof walletMandates.$inferSelect;
export type VenueConnection = typeof venueConnections.$inferSelect;
export type AgentProposal = typeof agentProposals.$inferSelect;
export type AgentNode = typeof agentNodes.$inferSelect;
export type AgentConversation = typeof agentConversations.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type AgentEvolutionEvent = typeof agentEvolutionEvents.$inferSelect;
export type Watchlist = typeof watchlists.$inferSelect;
export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type DiscoverySchedule = typeof discoverySchedules.$inferSelect;
export type DiscoveryFinding = typeof discoveryFindings.$inferSelect;
export type OperatorAction = typeof operatorActions.$inferSelect;
export type BindingChangeRequest = typeof bindingChangeRequests.$inferSelect;
export type SecurityAlert = typeof securityAlerts.$inferSelect;
export type PlatformApiKey = typeof platformApiKeys.$inferSelect;
export type AuthorityControl = typeof authorityControls.$inferSelect;

/**
 * Execution ledger events (Stage 1). Append-only: lifecycle transitions are
 * recorded as immutable events; state is derived, never rewritten in place.
 * Covers paper/sandbox execution; live execution reuses this ledger in Stage 5.
 */
export const executionLedger = mysqlTable("executionLedger", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  orderId: varchar("orderId", { length: 64 }).notNull(),
  /** Idempotency key supplied by the proposer; duplicates are rejected/returned as-is. */
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  venue: mysqlEnum("venue", ["binance", "evm", "polymarket"]).notNull(),
  /** Execution domain of this order: paper, sandbox, or live (Stage 5, gated by the authority machine). */
  executionMode: mysqlEnum("executionMode", ["paper", "sandbox", "live"]).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  side: mysqlEnum("side", ["BUY", "SELL"]).notNull(),
  orderType: mysqlEnum("orderType", ["MARKET", "LIMIT"]).notNull(),
  quantity: varchar("quantity", { length: 40 }),
  price: varchar("price", { length: 40 }),
  quoteOrderQty: varchar("quoteOrderQty", { length: 40 }),
  seq: int("seq").notNull(), // monotonically increasing event sequence per orderId
  eventType: mysqlEnum("eventType", [
    "proposed", "validated", "submitted", "filled", "rejected", "cancelled", "reconciled",
  ]).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  mandateId: varchar("mandateId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExecutionLedgerEvent = typeof executionLedger.$inferSelect;

/**
 * A single writer reservation for a live venue order. This is intentionally
 * separate from the append-only ledger: the unique key is acquired before any
 * external request, closing the concurrent read-then-submit race.
 */
export const liveOrderIntents = mysqlTable("liveOrderIntents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  orderHash: varchar("orderHash", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["reserved", "submitted", "filled", "rejected"]).default("reserved").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("live_order_intent_user_idempotency_unique").on(table.userId, table.idempotencyKey),
]);

export type LiveOrderIntent = typeof liveOrderIntents.$inferSelect;

/** Atomic, per-owner daily risk budget reserved before a live venue call. */
export const liveDailyRiskBuckets = mysqlTable("liveDailyRiskBuckets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  dayKey: varchar("dayKey", { length: 10 }).notNull(),
  // MySQL INT would overflow around $21.47m when values are stored as cents.
  // BIGINT preserves fixed-unit arithmetic for the configured policy ranges.
  reservedNotionalCents: bigint("reservedNotionalCents", { mode: "number" }).default(0).notNull(),
  reservedTradeCount: int("reservedTradeCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("live_daily_risk_user_day_unique").on(table.userId, table.dayKey),
]);

/** Current derived order state (projection of ledger events). Mutable projection, source of truth is the ledger. */
export const paperOrders = mysqlTable("paperOrders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  orderId: varchar("orderId", { length: 64 }).notNull().unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  venue: mysqlEnum("venue", ["binance", "evm", "polymarket"]).notNull(),
  executionMode: mysqlEnum("executionMode", ["paper", "sandbox", "live"]).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  side: mysqlEnum("side", ["BUY", "SELL"]).notNull(),
  orderType: mysqlEnum("orderType", ["MARKET", "LIMIT"]).notNull(),
  quantity: varchar("quantity", { length: 40 }),
  price: varchar("price", { length: 40 }),
  quoteOrderQty: varchar("quoteOrderQty", { length: 40 }),
  status: mysqlEnum("status", [
    "proposed", "validated", "submitted", "filled", "rejected", "cancelled", "reconciled",
  ]).default("proposed").notNull(),
  reconciliationState: mysqlEnum("reconciliationState", ["pending", "matched", "mismatched"]).default("pending").notNull(),
  fillPrice: varchar("fillPrice", { length: 40 }),
  executedQty: varchar("executedQty", { length: 40 }),
  mandateId: varchar("mandateId", { length: 64 }),
  rejectReason: varchar("rejectReason", { length: 400 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaperOrder = typeof paperOrders.$inferSelect;

/**
 * Wallet view sessions (Stage 4, view-first). Non-custodial: only public
 * session metadata is stored. No keys, no signing authority. Revocable.
 */
export const walletSessions = mysqlTable("walletSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  address: varchar("address", { length: 42 }).notNull(), // 0x + 20-byte hex, client-verified
  chainId: int("chainId").notNull(),
  provider: mysqlEnum("provider", ["walletconnect", "injected", "coinbase"]).notNull(),
  state: mysqlEnum("state", ["active", "revoked"]).default("active").notNull(),
  capabilities: json("capabilities").$type<string[]>().notNull(), // always ["view"] in Stage 4
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
});

export type WalletSessionRecord = typeof walletSessions.$inferSelect;

/** Per-order owner approvals (Stage 5, approval-required-live). One exact-order hash per approval row. */
export const liveOrderApprovals = mysqlTable("liveOrderApprovals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  orderHash: varchar("orderHash", { length: 16 }).notNull(), // liveOrderApprovalHash output
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  approvedBy: varchar("approvedBy", { length: 120 }).notNull(),
  consumedAt: timestamp("consumedAt"), // set when an order executes against this approval
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LiveOrderApproval = typeof liveOrderApprovals.$inferSelect;
