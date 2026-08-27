CREATE TABLE `agentIndividualConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`threadId` varchar(64) NOT NULL,
	`targetAgentId` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentIndividualConversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentIndividualConversations_threadId_unique` UNIQUE(`threadId`)
);
--> statement-breakpoint
CREATE TABLE `agentMemoryActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`actionId` varchar(64) NOT NULL,
	`memoryId` varchar(64) NOT NULL,
	`action` enum('created','promotion_requested','promotion_approved','promotion_rejected','retired','redacted') NOT NULL,
	`actorType` enum('owner','agent','system') NOT NULL,
	`actorAgentId` varchar(64),
	`fromScope` enum('shared','private'),
	`toScope` enum('shared','private'),
	`fromStatus` enum('active','pending_promotion','superseded','expired','redacted'),
	`toStatus` enum('active','pending_promotion','superseded','expired','redacted'),
	`reason` varchar(600),
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentMemoryActions_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentMemoryActions_actionId_unique` UNIQUE(`actionId`)
);
--> statement-breakpoint
CREATE TABLE `agentMemoryEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`memoryId` varchar(64) NOT NULL,
	`scope` enum('shared','private') NOT NULL,
	`agentId` varchar(64),
	`kind` enum('owner_instruction','constraint','verified_fact','research_note','question','decision','source_reference') NOT NULL,
	`content` text NOT NULL,
	`contentDigest` varchar(64) NOT NULL,
	`sourceType` enum('owner_entry','conversation','watchlist','policy','activity') NOT NULL,
	`sourceRef` varchar(160),
	`status` enum('active','pending_promotion','superseded','expired','redacted') NOT NULL DEFAULT 'active',
	`pinned` boolean NOT NULL DEFAULT false,
	`revision` int NOT NULL DEFAULT 1,
	`expiresAt` timestamp,
	`createdBy` enum('owner','agent','system') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentMemoryEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentMemoryEntries_memoryId_unique` UNIQUE(`memoryId`)
);
