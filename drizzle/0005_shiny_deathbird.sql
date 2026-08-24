CREATE TABLE `agentProposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`proposalId` varchar(64) NOT NULL,
	`runId` varchar(64),
	`walletRole` enum('trading','investment') NOT NULL,
	`venue` enum('binance','evm','polymarket') NOT NULL,
	`status` enum('review','approved','rejected','simulated','blocked') NOT NULL DEFAULT 'review',
	`policyResult` enum('pass','review','block') NOT NULL,
	`title` varchar(180) NOT NULL,
	`rationale` text NOT NULL,
	`action` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentProposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `agentProposals_proposalId_unique` UNIQUE(`proposalId`)
);
--> statement-breakpoint
CREATE TABLE `venueConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`connectionId` varchar(64) NOT NULL,
	`venue` enum('binance','evm','polymarket') NOT NULL,
	`state` enum('disconnected','simulation','armed','real') NOT NULL DEFAULT 'disconnected',
	`capabilities` json NOT NULL,
	`credentialRef` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `venueConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `venueConnections_connectionId_unique` UNIQUE(`connectionId`)
);
--> statement-breakpoint
CREATE TABLE `walletMandates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mandateId` varchar(64) NOT NULL,
	`walletRole` enum('trading','investment') NOT NULL,
	`venue` enum('binance','evm','polymarket') NOT NULL,
	`mode` enum('simulation','armed','real','paused') NOT NULL DEFAULT 'simulation',
	`status` enum('active','paused','disconnected') NOT NULL DEFAULT 'active',
	`allowedAssets` json NOT NULL,
	`maxOrderBps` int NOT NULL,
	`dailyCapBps` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `walletMandates_id` PRIMARY KEY(`id`),
	CONSTRAINT `walletMandates_mandateId_unique` UNIQUE(`mandateId`)
);
--> statement-breakpoint
ALTER TABLE `operatorActions` MODIFY COLUMN `kind` enum('policy_updated','simulation_started','simulation_blocked','onchain_viewed','scope_checked','outcome_recorded','promotion_changed','research_completed','mandate_created','mandate_mode_changed','venue_configured','proposal_created','proposal_approved','proposal_rejected','simulation_settled') NOT NULL;