CREATE TABLE `agentConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`threadId` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentConversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentConversations_threadId_unique` UNIQUE(`threadId`)
);
--> statement-breakpoint
CREATE TABLE `agentEvolutionEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`threadId` varchar(64),
	`agentId` varchar(64),
	`state` enum('delegated','working','completed','blocked','created','retired') NOT NULL,
	`summary` text NOT NULL,
	`evidence` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentEvolutionEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentEvolutionEvents_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `agentMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`messageId` varchar(64) NOT NULL,
	`threadId` varchar(64) NOT NULL,
	`actor` enum('owner','supervisor','agent','system') NOT NULL,
	`agentId` varchar(64),
	`content` text NOT NULL,
	`evidence` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentMessages_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentMessages_messageId_unique` UNIQUE(`messageId`)
);
--> statement-breakpoint
CREATE TABLE `agentNodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`roleKey` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`parentAgentId` varchar(64),
	`protectedRole` boolean NOT NULL DEFAULT false,
	`provider` enum('openai','anthropic','google','custom') NOT NULL,
	`model` varchar(160) NOT NULL,
	`toolScopes` json NOT NULL,
	`state` enum('active','paused','retired','review') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentNodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentNodes_agentId_unique` UNIQUE(`agentId`)
);
--> statement-breakpoint
CREATE TABLE `discoveryFindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`findingId` varchar(64) NOT NULL,
	`scheduleId` varchar(64),
	`watchlistItemId` varchar(64),
	`score` int NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL,
	`status` enum('watching','candidate','review','blocked') NOT NULL,
	`summary` text NOT NULL,
	`evidence` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discoveryFindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `discoveryFindings_findingId_unique` UNIQUE(`findingId`)
);
--> statement-breakpoint
CREATE TABLE `discoverySchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scheduleId` varchar(64) NOT NULL,
	`cadence` enum('daily','six_hour') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discoverySchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `discoverySchedules_scheduleId_unique` UNIQUE(`scheduleId`)
);
--> statement-breakpoint
CREATE TABLE `watchlistItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`itemId` varchar(64) NOT NULL,
	`watchlistId` varchar(64) NOT NULL,
	`label` varchar(120) NOT NULL,
	`address` varchar(64),
	`symbol` varchar(32),
	`chain` varchar(32),
	`status` enum('watching','candidate','review','blocked') NOT NULL DEFAULT 'watching',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlistItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `watchlistItems_itemId_unique` UNIQUE(`itemId`)
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`watchlistId` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`criteria` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `watchlists_watchlistId_unique` UNIQUE(`watchlistId`)
);
--> statement-breakpoint
ALTER TABLE `operatorActions` MODIFY COLUMN `kind` enum('policy_updated','simulation_started','simulation_blocked','onchain_viewed','scope_checked','outcome_recorded','promotion_changed','research_completed','mandate_created','mandate_mode_changed','venue_configured','proposal_created','proposal_approved','proposal_rejected','simulation_settled','agent_configured','subagent_created','subagent_retired','chat_message','watchlist_created','watchlist_updated','discovery_schedule_configured','discovery_completed') NOT NULL;