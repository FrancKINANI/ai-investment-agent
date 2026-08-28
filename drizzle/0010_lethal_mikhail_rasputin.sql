CREATE TABLE `liveDailyRiskBuckets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dayKey` varchar(10) NOT NULL,
	`reservedNotionalCents` bigint NOT NULL DEFAULT 0,
	`reservedTradeCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveDailyRiskBuckets_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_daily_risk_user_day_unique` UNIQUE(`userId`,`dayKey`)
);
--> statement-breakpoint
CREATE TABLE `liveOrderIntents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`orderHash` varchar(128) NOT NULL,
	`status` enum('reserved','submitted','filled','rejected') NOT NULL DEFAULT 'reserved',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liveOrderIntents_id` PRIMARY KEY(`id`),
	CONSTRAINT `live_order_intent_user_idempotency_unique` UNIQUE(`userId`,`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `operatorActions` MODIFY COLUMN `kind` enum('policy_updated','simulation_started','simulation_blocked','onchain_viewed','scope_checked','outcome_recorded','promotion_changed','research_completed','mandate_created','mandate_mode_changed','venue_configured','proposal_created','proposal_approved','proposal_rejected','simulation_settled','agent_configured','subagent_created','subagent_retired','chat_message','watchlist_created','watchlist_updated','discovery_schedule_configured','discovery_completed','platform_key_added','platform_key_removed','platform_key_disabled','wallet_connected','wallet_disconnected','mode_changed','authority_changed','alert_created','alert_acknowledged','owner_note') NOT NULL;--> statement-breakpoint
ALTER TABLE `platformApiKeys` MODIFY COLUMN `state` enum('active','disabled','testing') NOT NULL DEFAULT 'testing';