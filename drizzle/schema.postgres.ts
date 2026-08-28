import { bigint, boolean, integer, json, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const agentRoleEnum = pgEnum("agent_role", ["research", "onchain", "risk", "allocator", "supervisor"]);
export const providerEnum = pgEnum("provider", ["openai", "anthropic", "google", "custom"]);
export const agentStateEnum = pgEnum("agent_state", ["active", "paused", "review", "retired"]);
export const runStatusEnum = pgEnum("run_status", ["passed", "review", "blocked"]);
export const policyResultEnum = pgEnum("policy_result", ["pass", "review", "block"]);
export const awarenessLayerEnum = pgEnum("awareness_layer", ["action", "justification", "result", "evolutionary"]);
export const strategyStageEnum = pgEnum("strategy_stage", ["research", "simulation", "decision", "retired"]);
export const gateResultEnum = pgEnum("gate_result", ["pass", "review", "block"]);
export const deviationEnum = pgEnum("deviation", ["on_track", "underperforming", "outperforming", "inconclusive"]);
export const executionModeEnum = pgEnum("execution_mode", ["simulation", "read_only", "paper", "sandbox", "live"]);
export const walletRoleEnum = pgEnum("wallet_role", ["trading", "investment"]);
export const venueEnum = pgEnum("venue", ["binance", "evm", "polymarket"]);
export const mandateModeEnum = pgEnum("mandate_mode", ["simulation", "armed", "real", "paused"]);
export const connectionStateEnum = pgEnum("connection_state", ["disconnected", "simulation", "armed", "real"]);
export const mandateStatusEnum = pgEnum("mandate_status", ["active", "paused", "disconnected"]);
export const proposalStatusEnum = pgEnum("proposal_status", ["review", "approved", "rejected", "simulated", "blocked"]);
export const memoryScopeEnum = pgEnum("memory_scope", ["shared", "private"]);
export const memoryKindEnum = pgEnum("memory_kind", ["owner_instruction", "constraint", "verified_fact", "research_note", "question", "decision", "source_reference"]);
export const memoryStatusEnum = pgEnum("memory_status", ["active", "pending_promotion", "superseded", "expired", "redacted"]);
export const memoryActionEnum = pgEnum("memory_action", ["created", "promotion_requested", "promotion_approved", "promotion_rejected", "retired", "redacted"]);
export const actorTypeEnum = pgEnum("actor_type", ["owner", "agent", "system"]);
export const actorEnum = pgEnum("actor", ["owner", "supervisor", "agent", "system"]);
export const evolutionStateEnum = pgEnum("evolution_state", ["delegated", "working", "completed", "blocked", "created", "retired"]);
export const watchlistStatusEnum = pgEnum("watchlist_status", ["watching", "candidate", "review", "blocked"]);
export const cadenceEnum = pgEnum("cadence", ["daily", "six_hour"]);
export const confidenceEnum = pgEnum("confidence", ["low", "medium", "high"]);
export const authorityStateEnum = pgEnum("authority_state", [
  "disabled", "sandbox-only", "read-only-live",
  "approval-required-live", "limited-live", "paused", "revoked",
]);
export const actionStatusEnum = pgEnum("action_status", ["success", "review", "blocked"]);
export const bindingPermissionEnum = pgEnum("binding_permission", ["research-only", "simulation-only"]);
export const bindingStatusEnum = pgEnum("binding_status", ["pending", "approved", "rejected"]);
export const alertLevelEnum = pgEnum("alert_level", ["critical", "warning", "info"]);
export const platformEnum = pgEnum("platform", ["binance", "okx", "coinbase", "kraken", "polymarket"]);
export const platformKeyStateEnum = pgEnum("platform_key_state", ["active", "disabled", "testing"]);
export const sideEnum = pgEnum("side", ["BUY", "SELL"]);
export const orderTypeEnum = pgEnum("order_type", ["MARKET", "LIMIT"]);
export const ledgerEventTypeEnum = pgEnum("ledger_event_type", [
  "proposed", "validated", "submitted", "filled", "rejected", "cancelled", "reconciled",
]);
export const intentStatusEnum = pgEnum("intent_status", ["reserved", "submitted", "filled", "rejected"]);
export const reconciliationStateEnum = pgEnum("reconciliation_state", ["pending", "matched", "mismatched"]);
export const walletProviderEnum = pgEnum("wallet_provider", ["walletconnect", "injected", "coinbase"]);
export const walletSessionStateEnum = pgEnum("wallet_session_state", ["active", "revoked"]);

// ─── Core Identity ──────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const agentProfiles = pgTable("agentProfiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  role: agentRoleEnum("role").notNull(),
  provider: providerEnum("provider").notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  toolScopes: json("toolScopes").$type<string[]>().notNull(),
  state: agentStateEnum("state").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const agentRuns = pgTable("agentRuns", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  runId: varchar("runId", { length: 64 }).notNull(),
  status: runStatusEnum("status").notNull(),
  policyResult: policyResultEnum("policyResult").notNull(),
  simulationOnly: boolean("simulationOnly").default(true).notNull(),
  summary: text("summary").notNull(),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const awarenessRecords = pgTable("awarenessRecords", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  layer: awarenessLayerEnum("layer").notNull(),
  subject: varchar("subject", { length: 160 }).notNull(),
  runId: varchar("runId", { length: 64 }),
  evidence: json("evidence").$type<string[]>().notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const strategyLineages = pgTable("strategyLineages", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  lineageId: varchar("lineageId", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  stage: strategyStageEnum("stage").default("research").notNull(),
  generation: integer("generation").default(1).notNull(),
  parentVersion: varchar("parentVersion", { length: 64 }),
  scores: json("scores").$type<Record<string, number>>().notNull(),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const strategyEvaluations = pgTable("strategyEvaluations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  lineageId: varchar("lineageId", { length: 64 }).notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  gateResult: gateResultEnum("gateResult").notNull(),
  simulationPassed: boolean("simulationPassed").default(false).notNull(),
  coverage: integer("coverage").default(0).notNull(),
  complexityPenalty: integer("complexityPenalty").default(0).notNull(),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const outcomeRecords = pgTable("outcomeRecords", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  lineageId: varchar("lineageId", { length: 64 }).notNull(),
  runId: varchar("runId", { length: 64 }),
  expectedBps: integer("expectedBps").notNull(),
  realizedBps: integer("realizedBps"),
  attribution: json("attribution").$type<Record<string, string | number | boolean | null>>().notNull(),
  deviation: deviationEnum("deviation").default("inconclusive").notNull(),
  narrative: text("narrative").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Policy & Mandates ──────────────────────────────────────────────────────

export const investmentPolicies = pgTable("investmentPolicies", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  version: integer("version").default(1).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  maxConcentrationBps: integer("maxConcentrationBps").notNull(),
  minReserveBps: integer("minReserveBps").notNull(),
  maxTransactionBps: integer("maxTransactionBps").notNull(),
  dailyMandateBps: integer("dailyMandateBps").notNull(),
  allowedAssets: json("allowedAssets").$type<string[]>().notNull(),
  executionMode: executionModeEnum("executionMode").default("simulation").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const walletMandates = pgTable("walletMandates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  mandateId: varchar("mandateId", { length: 64 }).notNull().unique(),
  walletRole: walletRoleEnum("walletRole").notNull(),
  venue: venueEnum("venue").notNull(),
  mode: mandateModeEnum("mode").default("simulation").notNull(),
  status: mandateStatusEnum("status").default("active").notNull(),
  allowedAssets: json("allowedAssets").$type<string[]>().notNull(),
  maxOrderBps: integer("maxOrderBps").notNull(),
  dailyCapBps: integer("dailyCapBps").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const venueConnections = pgTable("venueConnections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  connectionId: varchar("connectionId", { length: 64 }).notNull().unique(),
  venue: venueEnum("venue").notNull(),
  state: connectionStateEnum("state").default("disconnected").notNull(),
  capabilities: json("capabilities").$type<string[]>().notNull(),
  credentialRef: varchar("credentialRef", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Agent Nodes & Conversations ────────────────────────────────────────────

export const agentNodes = pgTable("agentNodes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  agentId: varchar("agentId", { length: 64 }).notNull().unique(),
  roleKey: varchar("roleKey", { length: 64 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  parentAgentId: varchar("parentAgentId", { length: 64 }),
  protectedRole: boolean("protectedRole").default(false).notNull(),
  provider: providerEnum("provider").notNull(),
  model: varchar("model", { length: 160 }).notNull(),
  toolScopes: json("toolScopes").$type<string[]>().notNull(),
  state: agentStateEnum("state").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const agentConversations = pgTable("agentConversations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  threadId: varchar("threadId", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const agentIndividualConversations = pgTable("agentIndividualConversations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  threadId: varchar("threadId", { length: 64 }).notNull().unique(),
  targetAgentId: varchar("targetAgentId", { length: 64 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const agentMessages = pgTable("agentMessages", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  threadId: varchar("threadId", { length: 64 }).notNull(),
  actor: actorEnum("actor").notNull(),
  agentId: varchar("agentId", { length: 64 }),
  content: text("content").notNull(),
  confidence: integer("confidence"),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Memory System ──────────────────────────────────────────────────────────

export const agentMemoryEntries = pgTable("agentMemoryEntries", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  memoryId: varchar("memoryId", { length: 64 }).notNull().unique(),
  scope: memoryScopeEnum("scope").notNull(),
  agentId: varchar("agentId", { length: 64 }),
  kind: memoryKindEnum("kind").notNull(),
  content: text("content").notNull(),
  contentDigest: varchar("contentDigest", { length: 64 }).notNull(),
  sourceType: varchar("sourceType", { length: 50 }).notNull(),
  sourceRef: varchar("sourceRef", { length: 160 }),
  status: memoryStatusEnum("status").default("active").notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  revision: integer("revision").default(1).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdBy: actorTypeEnum("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const agentMemoryActions = pgTable("agentMemoryActions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(),
  memoryId: varchar("memoryId", { length: 64 }).notNull(),
  action: memoryActionEnum("action").notNull(),
  actorType: actorTypeEnum("actorType").notNull(),
  actorAgentId: varchar("actorAgentId", { length: 64 }),
  fromScope: memoryScopeEnum("fromScope"),
  toScope: memoryScopeEnum("toScope"),
  fromStatus: memoryStatusEnum("fromStatus"),
  toStatus: memoryStatusEnum("toStatus"),
  reason: varchar("reason", { length: 600 }),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const agentEvolutionEvents = pgTable("agentEvolutionEvents", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  threadId: varchar("threadId", { length: 64 }),
  agentId: varchar("agentId", { length: 64 }),
  state: evolutionStateEnum("state").notNull(),
  summary: text("summary").notNull(),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Watchlists & Discovery ─────────────────────────────────────────────────

export const watchlists = pgTable("watchlists", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  watchlistId: varchar("watchlistId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  criteria: json("criteria").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const watchlistItems = pgTable("watchlistItems", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  itemId: varchar("itemId", { length: 64 }).notNull().unique(),
  watchlistId: varchar("watchlistId", { length: 64 }).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  address: varchar("address", { length: 64 }),
  symbol: varchar("symbol", { length: 32 }),
  chain: varchar("chain", { length: 32 }),
  status: watchlistStatusEnum("status").default("watching").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const discoverySchedules = pgTable("discoverySchedules", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  scheduleId: varchar("scheduleId", { length: 64 }).notNull().unique(),
  cadence: cadenceEnum("cadence").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const discoveryFindings = pgTable("discoveryFindings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  findingId: varchar("findingId", { length: 64 }).notNull().unique(),
  scheduleId: varchar("scheduleId", { length: 64 }),
  watchlistItemId: varchar("watchlistItemId", { length: 64 }),
  score: integer("score").notNull(),
  confidence: confidenceEnum("confidence").notNull(),
  status: watchlistStatusEnum("status").notNull(),
  summary: text("summary").notNull(),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Authority & Operations ─────────────────────────────────────────────────

export const authorityControls = pgTable("authorityControls", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  state: authorityStateEnum("state").default("disabled").notNull(),
  machineVersion: integer("machineVersion").default(1).notNull(),
  updatedBy: varchar("updatedBy", { length: 120 }),
  reason: varchar("reason", { length: 800 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const operatorActions = pgTable("operatorActions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  actionId: varchar("actionId", { length: 64 }).notNull().unique(),
  kind: varchar("kind", { length: 50 }).notNull(),
  status: actionStatusEnum("status").notNull(),
  subject: varchar("subject", { length: 160 }).notNull(),
  detail: text("detail").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const bindingChangeRequests = pgTable("bindingChangeRequests", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  requestId: varchar("requestId", { length: 64 }).notNull().unique(),
  capabilityId: varchar("capabilityId", { length: 120 }).notNull(),
  roleKeys: json("roleKeys").$type<string[]>().notNull(),
  permission: bindingPermissionEnum("permission").notNull(),
  rationale: text("rationale").notNull(),
  status: bindingStatusEnum("status").default("pending").notNull(),
  reviewerUserId: integer("reviewerUserId"),
  reviewNote: text("reviewNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const securityAlerts = pgTable("securityAlerts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  alertId: varchar("alertId", { length: 64 }).notNull().unique(),
  level: alertLevelEnum("level").notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  detail: text("detail").notNull(),
  actionRef: varchar("actionRef", { length: 64 }),
  acknowledged: boolean("acknowledged").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const platformApiKeys = pgTable("platformApiKeys", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  keyId: varchar("keyId", { length: 64 }).notNull().unique(),
  platform: platformEnum("platform").notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 16 }).notNull(),
  apiKeyEncrypted: varchar("apiKeyEncrypted", { length: 512 }).notNull(),
  secretEncrypted: varchar("secretEncrypted", { length: 512 }).notNull(),
  permissions: json("permissions").$type<string[]>().notNull(),
  hasWithdrawPermission: boolean("hasWithdrawPermission").default(false).notNull(),
  state: platformKeyStateEnum("state").default("testing").notNull(),
  maxOrderUsd: integer("maxOrderUsd"),
  allocatedCapitalUsd: integer("allocatedCapitalUsd"),
  dailyTradeLimit: integer("dailyTradeLimit"),
  lastTestedAt: timestamp("lastTestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// ─── Execution ──────────────────────────────────────────────────────────────

export const agentProposals = pgTable("agentProposals", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  proposalId: varchar("proposalId", { length: 64 }).notNull().unique(),
  runId: varchar("runId", { length: 64 }),
  walletRole: walletRoleEnum("walletRole").notNull(),
  venue: venueEnum("venue").notNull(),
  status: proposalStatusEnum("status").default("review").notNull(),
  policyResult: policyResultEnum("policyResult").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  rationale: text("rationale").notNull(),
  action: json("action").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const executionLedger = pgTable("executionLedger", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  eventId: varchar("eventId", { length: 64 }).notNull().unique(),
  orderId: varchar("orderId", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  venue: venueEnum("venue").notNull(),
  executionMode: executionModeEnum("executionMode").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  side: sideEnum("side").notNull(),
  orderType: orderTypeEnum("orderType").notNull(),
  quantity: varchar("quantity", { length: 40 }),
  price: varchar("price", { length: 40 }),
  quoteOrderQty: varchar("quoteOrderQty", { length: 40 }),
  seq: integer("seq").notNull(),
  eventType: ledgerEventTypeEnum("eventType").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  mandateId: varchar("mandateId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const liveOrderIntents = pgTable("liveOrderIntents", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  orderHash: varchar("orderHash", { length: 128 }).notNull(),
  status: intentStatusEnum("status").default("reserved").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("live_order_intent_user_idempotency_unique").on(table.userId, table.idempotencyKey),
]);

export const liveDailyRiskBuckets = pgTable("liveDailyRiskBuckets", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  dayKey: varchar("dayKey", { length: 10 }).notNull(),
  reservedNotionalCents: bigint("reservedNotionalCents", { mode: "number" }).default(0).notNull(),
  reservedTradeCount: integer("reservedTradeCount").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("live_daily_risk_user_day_unique").on(table.userId, table.dayKey),
]);

export const paperOrders = pgTable("paperOrders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  orderId: varchar("orderId", { length: 64 }).notNull().unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  venue: venueEnum("venue").notNull(),
  executionMode: executionModeEnum("executionMode").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  side: sideEnum("side").notNull(),
  orderType: orderTypeEnum("orderType").notNull(),
  quantity: varchar("quantity", { length: 40 }),
  price: varchar("price", { length: 40 }),
  quoteOrderQty: varchar("quoteOrderQty", { length: 40 }),
  status: varchar("status", { length: 20 }).default("proposed").notNull(),
  reconciliationState: reconciliationStateEnum("reconciliationState").default("pending").notNull(),
  fillPrice: varchar("fillPrice", { length: 40 }),
  executedQty: varchar("executedQty", { length: 40 }),
  mandateId: varchar("mandateId", { length: 64 }),
  rejectReason: varchar("rejectReason", { length: 400 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const walletSessions = pgTable("walletSessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  address: varchar("address", { length: 42 }).notNull(),
  chainId: integer("chainId").notNull(),
  provider: walletProviderEnum("provider").notNull(),
  state: walletSessionStateEnum("state").default("active").notNull(),
  capabilities: json("capabilities").$type<string[]>().notNull(),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
});

export const liveOrderApprovals = pgTable("liveOrderApprovals", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  orderHash: varchar("orderHash", { length: 16 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
  approvedBy: varchar("approvedBy", { length: 120 }).notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Type Exports ───────────────────────────────────────────────────────────

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
export type AgentIndividualConversation = typeof agentIndividualConversations.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type AgentMemoryEntry = typeof agentMemoryEntries.$inferSelect;
export type AgentMemoryAction = typeof agentMemoryActions.$inferSelect;
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
export type ExecutionLedgerEvent = typeof executionLedger.$inferSelect;
export type LiveOrderIntent = typeof liveOrderIntents.$inferSelect;
export type PaperOrder = typeof paperOrders.$inferSelect;
export type WalletSessionRecord = typeof walletSessions.$inferSelect;
export type LiveOrderApproval = typeof liveOrderApprovals.$inferSelect;
