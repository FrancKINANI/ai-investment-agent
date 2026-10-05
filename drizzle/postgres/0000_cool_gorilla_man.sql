CREATE TYPE "public"."action_status" AS ENUM('success', 'review', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."actor" AS ENUM('owner', 'supervisor', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('owner', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."agent_role" AS ENUM('research', 'onchain', 'risk', 'allocator', 'supervisor');--> statement-breakpoint
CREATE TYPE "public"."agent_state" AS ENUM('active', 'paused', 'review', 'retired');--> statement-breakpoint
CREATE TYPE "public"."alert_level" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."authority_state" AS ENUM('disabled', 'sandbox-only', 'read-only-live', 'approval-required-live', 'limited-live', 'paused', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."awareness_layer" AS ENUM('action', 'justification', 'result', 'evolutionary');--> statement-breakpoint
CREATE TYPE "public"."binding_permission" AS ENUM('research-only', 'simulation-only');--> statement-breakpoint
CREATE TYPE "public"."binding_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."cadence" AS ENUM('daily', 'six_hour');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."connection_state" AS ENUM('disconnected', 'simulation', 'armed', 'real');--> statement-breakpoint
CREATE TYPE "public"."deviation" AS ENUM('on_track', 'underperforming', 'outperforming', 'inconclusive');--> statement-breakpoint
CREATE TYPE "public"."evolution_state" AS ENUM('delegated', 'working', 'completed', 'blocked', 'created', 'retired');--> statement-breakpoint
CREATE TYPE "public"."execution_mode" AS ENUM('simulation', 'read_only', 'paper', 'sandbox', 'live');--> statement-breakpoint
CREATE TYPE "public"."gate_result" AS ENUM('pass', 'review', 'block');--> statement-breakpoint
CREATE TYPE "public"."intent_status" AS ENUM('reserved', 'submitted', 'filled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ledger_event_type" AS ENUM('proposed', 'validated', 'submitted', 'filled', 'rejected', 'cancelled', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."mandate_mode" AS ENUM('simulation', 'armed', 'real', 'paused');--> statement-breakpoint
CREATE TYPE "public"."mandate_status" AS ENUM('active', 'paused', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."memory_action" AS ENUM('created', 'promotion_requested', 'promotion_approved', 'promotion_rejected', 'retired', 'redacted');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('owner_instruction', 'constraint', 'verified_fact', 'research_note', 'question', 'decision', 'source_reference');--> statement-breakpoint
CREATE TYPE "public"."memory_scope" AS ENUM('shared', 'private');--> statement-breakpoint
CREATE TYPE "public"."memory_status" AS ENUM('active', 'pending_promotion', 'superseded', 'expired', 'redacted');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('MARKET', 'LIMIT');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('binance', 'okx', 'coinbase', 'kraken', 'polymarket');--> statement-breakpoint
CREATE TYPE "public"."platform_key_state" AS ENUM('active', 'disabled', 'testing');--> statement-breakpoint
CREATE TYPE "public"."policy_result" AS ENUM('pass', 'review', 'block');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('review', 'approved', 'rejected', 'simulated', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('openai', 'anthropic', 'google', 'custom');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_state" AS ENUM('pending', 'matched', 'mismatched');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('passed', 'review', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('BUY', 'SELL');--> statement-breakpoint
CREATE TYPE "public"."strategy_stage" AS ENUM('research', 'simulation', 'decision', 'retired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."venue" AS ENUM('binance', 'evm', 'polymarket');--> statement-breakpoint
CREATE TYPE "public"."wallet_provider" AS ENUM('walletconnect', 'injected', 'coinbase');--> statement-breakpoint
CREATE TYPE "public"."wallet_role" AS ENUM('trading', 'investment');--> statement-breakpoint
CREATE TYPE "public"."wallet_session_state" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."watchlist_status" AS ENUM('watching', 'candidate', 'review', 'blocked');--> statement-breakpoint
CREATE TABLE "agentConversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"threadId" varchar(64) NOT NULL,
	"title" varchar(180) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentConversations_threadId_unique" UNIQUE("threadId")
);
--> statement-breakpoint
CREATE TABLE "agentEvolutionEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"eventId" varchar(64) NOT NULL,
	"threadId" varchar(64),
	"agentId" varchar(64),
	"state" "evolution_state" NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentEvolutionEvents_eventId_unique" UNIQUE("eventId")
);
--> statement-breakpoint
CREATE TABLE "agentIndividualConversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"threadId" varchar(64) NOT NULL,
	"targetAgentId" varchar(64) NOT NULL,
	"title" varchar(180) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentIndividualConversations_threadId_unique" UNIQUE("threadId")
);
--> statement-breakpoint
CREATE TABLE "agentMemoryActions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"actionId" varchar(64) NOT NULL,
	"memoryId" varchar(64) NOT NULL,
	"action" "memory_action" NOT NULL,
	"actorType" "actor_type" NOT NULL,
	"actorAgentId" varchar(64),
	"fromScope" "memory_scope",
	"toScope" "memory_scope",
	"fromStatus" "memory_status",
	"toStatus" "memory_status",
	"reason" varchar(600),
	"payload" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentMemoryActions_actionId_unique" UNIQUE("actionId")
);
--> statement-breakpoint
CREATE TABLE "agentMemoryEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"memoryId" varchar(64) NOT NULL,
	"scope" "memory_scope" NOT NULL,
	"agentId" varchar(64),
	"kind" "memory_kind" NOT NULL,
	"content" text NOT NULL,
	"contentDigest" varchar(64) NOT NULL,
	"sourceType" varchar(50) NOT NULL,
	"sourceRef" varchar(160),
	"status" "memory_status" DEFAULT 'active' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"expiresAt" timestamp,
	"createdBy" "actor_type" NOT NULL,
	"searchVector" "tsvector",
	"embedding" vector(1536),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentMemoryEntries_memoryId_unique" UNIQUE("memoryId")
);
--> statement-breakpoint
CREATE TABLE "agentMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"messageId" varchar(64) NOT NULL,
	"threadId" varchar(64) NOT NULL,
	"actor" "actor" NOT NULL,
	"agentId" varchar(64),
	"content" text NOT NULL,
	"confidence" integer,
	"evidence" jsonb NOT NULL,
	"searchVector" "tsvector",
	"embedding" vector(1536),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentMessages_messageId_unique" UNIQUE("messageId")
);
--> statement-breakpoint
CREATE TABLE "agentNodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"roleKey" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"parentAgentId" varchar(64),
	"protectedRole" boolean DEFAULT false NOT NULL,
	"provider" "provider" NOT NULL,
	"model" varchar(160) NOT NULL,
	"toolScopes" jsonb NOT NULL,
	"state" "agent_state" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentNodes_agentId_unique" UNIQUE("agentId")
);
--> statement-breakpoint
CREATE TABLE "agentProfiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" "agent_role" NOT NULL,
	"provider" "provider" NOT NULL,
	"model" varchar(120) NOT NULL,
	"toolScopes" jsonb NOT NULL,
	"state" "agent_state" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agentProposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"proposalId" varchar(64) NOT NULL,
	"runId" varchar(64),
	"walletRole" "wallet_role" NOT NULL,
	"venue" "venue" NOT NULL,
	"status" "proposal_status" DEFAULT 'review' NOT NULL,
	"policyResult" "policy_result" NOT NULL,
	"title" varchar(180) NOT NULL,
	"rationale" text NOT NULL,
	"action" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agentProposals_proposalId_unique" UNIQUE("proposalId")
);
--> statement-breakpoint
CREATE TABLE "agentRuns" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"runId" varchar(64) NOT NULL,
	"status" "run_status" NOT NULL,
	"policyResult" "policy_result" NOT NULL,
	"simulationOnly" boolean DEFAULT true NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorityControls" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"state" "authority_state" DEFAULT 'disabled' NOT NULL,
	"machineVersion" integer DEFAULT 1 NOT NULL,
	"updatedBy" varchar(120),
	"reason" varchar(800),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "authorityControls_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "awarenessRecords" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"layer" "awareness_layer" NOT NULL,
	"subject" varchar(160) NOT NULL,
	"runId" varchar(64),
	"evidence" jsonb NOT NULL,
	"summary" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bindingChangeRequests" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"requestId" varchar(64) NOT NULL,
	"capabilityId" varchar(120) NOT NULL,
	"roleKeys" jsonb NOT NULL,
	"permission" "binding_permission" NOT NULL,
	"rationale" text NOT NULL,
	"status" "binding_status" DEFAULT 'pending' NOT NULL,
	"reviewerUserId" integer,
	"reviewNote" text,
	"reviewedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bindingChangeRequests_requestId_unique" UNIQUE("requestId")
);
--> statement-breakpoint
CREATE TABLE "discoveryFindings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"findingId" varchar(64) NOT NULL,
	"scheduleId" varchar(64),
	"watchlistItemId" varchar(64),
	"score" integer NOT NULL,
	"confidence" "confidence" NOT NULL,
	"status" "watchlist_status" NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discoveryFindings_findingId_unique" UNIQUE("findingId")
);
--> statement-breakpoint
CREATE TABLE "discoverySchedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"scheduleId" varchar(64) NOT NULL,
	"cadence" "cadence" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"scheduleCronTaskUid" varchar(65),
	"lastRunAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discoverySchedules_scheduleId_unique" UNIQUE("scheduleId")
);
--> statement-breakpoint
CREATE TABLE "executionLedger" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"eventId" varchar(64) NOT NULL,
	"orderId" varchar(64) NOT NULL,
	"idempotencyKey" varchar(128) NOT NULL,
	"venue" "venue" NOT NULL,
	"executionMode" "execution_mode" NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"side" "side" NOT NULL,
	"orderType" "order_type" NOT NULL,
	"quantity" varchar(40),
	"price" varchar(40),
	"quoteOrderQty" varchar(40),
	"seq" integer NOT NULL,
	"eventType" "ledger_event_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"mandateId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "executionLedger_eventId_unique" UNIQUE("eventId")
);
--> statement-breakpoint
CREATE TABLE "investmentPolicies" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" varchar(120) NOT NULL,
	"maxConcentrationBps" integer NOT NULL,
	"minReserveBps" integer NOT NULL,
	"maxTransactionBps" integer NOT NULL,
	"dailyMandateBps" integer NOT NULL,
	"allowedAssets" jsonb NOT NULL,
	"executionMode" "execution_mode" DEFAULT 'simulation' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "investmentPolicies_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "liveDailyRiskBuckets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"dayKey" varchar(10) NOT NULL,
	"reservedNotionalCents" bigint DEFAULT 0 NOT NULL,
	"reservedTradeCount" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liveOrderApprovals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"orderHash" varchar(16) NOT NULL,
	"idempotencyKey" varchar(128) NOT NULL,
	"approvedBy" varchar(120) NOT NULL,
	"consumedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liveOrderIntents" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"idempotencyKey" varchar(128) NOT NULL,
	"orderHash" varchar(128) NOT NULL,
	"status" "intent_status" DEFAULT 'reserved' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operatorActions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"actionId" varchar(64) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"status" "action_status" NOT NULL,
	"subject" varchar(160) NOT NULL,
	"detail" text NOT NULL,
	"payload" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "operatorActions_actionId_unique" UNIQUE("actionId")
);
--> statement-breakpoint
CREATE TABLE "outcomeRecords" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"lineageId" varchar(64) NOT NULL,
	"runId" varchar(64),
	"expectedBps" integer NOT NULL,
	"realizedBps" integer,
	"attribution" jsonb NOT NULL,
	"deviation" "deviation" DEFAULT 'inconclusive' NOT NULL,
	"narrative" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paperOrders" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"orderId" varchar(64) NOT NULL,
	"idempotencyKey" varchar(128) NOT NULL,
	"venue" "venue" NOT NULL,
	"executionMode" "execution_mode" NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"side" "side" NOT NULL,
	"orderType" "order_type" NOT NULL,
	"quantity" varchar(40),
	"price" varchar(40),
	"quoteOrderQty" varchar(40),
	"status" varchar(20) DEFAULT 'proposed' NOT NULL,
	"reconciliationState" "reconciliation_state" DEFAULT 'pending' NOT NULL,
	"fillPrice" varchar(40),
	"executedQty" varchar(40),
	"mandateId" varchar(64),
	"rejectReason" varchar(400),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "paperOrders_orderId_unique" UNIQUE("orderId")
);
--> statement-breakpoint
CREATE TABLE "platformApiKeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"keyId" varchar(64) NOT NULL,
	"platform" "platform" NOT NULL,
	"label" varchar(120) NOT NULL,
	"keyPrefix" varchar(16) NOT NULL,
	"apiKeyEncrypted" varchar(512) NOT NULL,
	"secretEncrypted" varchar(512) NOT NULL,
	"permissions" jsonb NOT NULL,
	"hasWithdrawPermission" boolean DEFAULT false NOT NULL,
	"state" "platform_key_state" DEFAULT 'testing' NOT NULL,
	"maxOrderUsd" integer,
	"allocatedCapitalUsd" integer,
	"dailyTradeLimit" integer,
	"lastTestedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platformApiKeys_keyId_unique" UNIQUE("keyId")
);
--> statement-breakpoint
CREATE TABLE "securityAlerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"alertId" varchar(64) NOT NULL,
	"level" "alert_level" NOT NULL,
	"category" varchar(80) NOT NULL,
	"title" varchar(160) NOT NULL,
	"detail" text NOT NULL,
	"actionRef" varchar(64),
	"acknowledged" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "securityAlerts_alertId_unique" UNIQUE("alertId")
);
--> statement-breakpoint
CREATE TABLE "strategyEvaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"lineageId" varchar(64) NOT NULL,
	"version" varchar(64) NOT NULL,
	"gateResult" "gate_result" NOT NULL,
	"simulationPassed" boolean DEFAULT false NOT NULL,
	"coverage" integer DEFAULT 0 NOT NULL,
	"complexityPenalty" integer DEFAULT 0 NOT NULL,
	"rationale" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategyLineages" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"lineageId" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"stage" "strategy_stage" DEFAULT 'research' NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"parentVersion" varchar(64),
	"scores" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "venueConnections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"connectionId" varchar(64) NOT NULL,
	"venue" "venue" NOT NULL,
	"state" "connection_state" DEFAULT 'disconnected' NOT NULL,
	"capabilities" jsonb NOT NULL,
	"credentialRef" varchar(160),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "venueConnections_connectionId_unique" UNIQUE("connectionId")
);
--> statement-breakpoint
CREATE TABLE "walletMandates" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"mandateId" varchar(64) NOT NULL,
	"walletRole" "wallet_role" NOT NULL,
	"venue" "venue" NOT NULL,
	"mode" "mandate_mode" DEFAULT 'simulation' NOT NULL,
	"status" "mandate_status" DEFAULT 'active' NOT NULL,
	"allowedAssets" jsonb NOT NULL,
	"maxOrderBps" integer NOT NULL,
	"dailyCapBps" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "walletMandates_mandateId_unique" UNIQUE("mandateId")
);
--> statement-breakpoint
CREATE TABLE "walletSessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sessionId" varchar(64) NOT NULL,
	"address" varchar(42) NOT NULL,
	"chainId" integer NOT NULL,
	"provider" "wallet_provider" NOT NULL,
	"state" "wallet_session_state" DEFAULT 'active' NOT NULL,
	"capabilities" jsonb NOT NULL,
	"connectedAt" timestamp DEFAULT now() NOT NULL,
	"revokedAt" timestamp,
	CONSTRAINT "walletSessions_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "watchlistItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"itemId" varchar(64) NOT NULL,
	"watchlistId" varchar(64) NOT NULL,
	"label" varchar(120) NOT NULL,
	"address" varchar(64),
	"symbol" varchar(32),
	"chain" varchar(32),
	"status" "watchlist_status" DEFAULT 'watching' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watchlistItems_itemId_unique" UNIQUE("itemId")
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"watchlistId" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"criteria" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watchlists_watchlistId_unique" UNIQUE("watchlistId")
);
--> statement-breakpoint
CREATE INDEX "idx_memory_search_vector" ON "agentMemoryEntries" USING gin ("searchVector");--> statement-breakpoint
CREATE INDEX "idx_message_search_vector" ON "agentMessages" USING gin ("searchVector");--> statement-breakpoint
CREATE UNIQUE INDEX "live_daily_risk_user_day_unique" ON "liveDailyRiskBuckets" USING btree ("userId","dayKey");--> statement-breakpoint
CREATE UNIQUE INDEX "live_order_intent_user_idempotency_unique" ON "liveOrderIntents" USING btree ("userId","idempotencyKey");