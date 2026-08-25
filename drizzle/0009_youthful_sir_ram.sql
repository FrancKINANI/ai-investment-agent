CREATE TABLE `authorityControls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`state` enum('disabled','sandbox-only','read-only-live','approval-required-live','limited-live','paused','revoked') NOT NULL DEFAULT 'disabled',
	`machineVersion` int NOT NULL DEFAULT 1,
	`updatedBy` varchar(120),
	`reason` varchar(800),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authorityControls_id` PRIMARY KEY(`id`),
	CONSTRAINT `authorityControls_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `executionLedger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`venue` enum('binance','evm','polymarket') NOT NULL,
	`executionMode` enum('paper','sandbox','live') NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`side` enum('BUY','SELL') NOT NULL,
	`orderType` enum('MARKET','LIMIT') NOT NULL,
	`quantity` varchar(40),
	`price` varchar(40),
	`quoteOrderQty` varchar(40),
	`seq` int NOT NULL,
	`eventType` enum('proposed','validated','submitted','filled','rejected','cancelled','reconciled') NOT NULL,
	`payload` json NOT NULL,
	`mandateId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executionLedger_id` PRIMARY KEY(`id`),
	CONSTRAINT `executionLedger_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `liveOrderApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orderHash` varchar(16) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`approvedBy` varchar(120) NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `liveOrderApprovals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paperOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`venue` enum('binance','evm','polymarket') NOT NULL,
	`executionMode` enum('paper','sandbox','live') NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`side` enum('BUY','SELL') NOT NULL,
	`orderType` enum('MARKET','LIMIT') NOT NULL,
	`quantity` varchar(40),
	`price` varchar(40),
	`quoteOrderQty` varchar(40),
	`status` enum('proposed','validated','submitted','filled','rejected','cancelled','reconciled') NOT NULL DEFAULT 'proposed',
	`reconciliationState` enum('pending','matched','mismatched') NOT NULL DEFAULT 'pending',
	`fillPrice` varchar(40),
	`executedQty` varchar(40),
	`mandateId` varchar(64),
	`rejectReason` varchar(400),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paperOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `paperOrders_orderId_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `platformApiKeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`keyId` varchar(64) NOT NULL,
	`platform` enum('binance','okx','coinbase','kraken','polymarket') NOT NULL,
	`label` varchar(120) NOT NULL,
	`keyPrefix` varchar(16) NOT NULL,
	`apiKeyEncrypted` varchar(512) NOT NULL,
	`secretEncrypted` varchar(512) NOT NULL,
	`permissions` json NOT NULL,
	`hasWithdrawPermission` boolean NOT NULL DEFAULT false,
	`state` enum('active','disabled','testing') NOT NULL DEFAULT 'active',
	`maxOrderUsd` int,
	`allocatedCapitalUsd` int,
	`dailyTradeLimit` int,
	`lastTestedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platformApiKeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `platformApiKeys_keyId_unique` UNIQUE(`keyId`)
);
--> statement-breakpoint
CREATE TABLE `securityAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`alertId` varchar(64) NOT NULL,
	`level` enum('critical','warning','info') NOT NULL,
	`category` varchar(80) NOT NULL,
	`title` varchar(160) NOT NULL,
	`detail` text NOT NULL,
	`actionRef` varchar(64),
	`acknowledged` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `securityAlerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `securityAlerts_alertId_unique` UNIQUE(`alertId`)
);
--> statement-breakpoint
CREATE TABLE `walletSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`address` varchar(42) NOT NULL,
	`chainId` int NOT NULL,
	`provider` enum('walletconnect','injected','coinbase') NOT NULL,
	`state` enum('active','revoked') NOT NULL DEFAULT 'active',
	`capabilities` json NOT NULL,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `walletSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `walletSessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `operatorActions` MODIFY COLUMN `kind` enum('policy_updated','simulation_started','simulation_blocked','onchain_viewed','scope_checked','outcome_recorded','promotion_changed','research_completed','mandate_created','mandate_mode_changed','venue_configured','proposal_created','proposal_approved','proposal_rejected','simulation_settled','agent_configured','subagent_created','subagent_retired','chat_message','watchlist_created','watchlist_updated','discovery_schedule_configured','discovery_completed','platform_key_added','platform_key_removed','platform_key_disabled','wallet_connected','wallet_disconnected','mode_changed','authority_changed','alert_created','alert_acknowledged') NOT NULL;