CREATE TABLE `agentProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` enum('research','onchain','risk','allocator','supervisor') NOT NULL,
	`provider` enum('openai','anthropic','google','custom') NOT NULL,
	`model` varchar(120) NOT NULL,
	`toolScopes` json NOT NULL,
	`state` enum('active','paused','review') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`runId` varchar(64) NOT NULL,
	`status` enum('passed','review','blocked') NOT NULL,
	`policyResult` enum('pass','review','block') NOT NULL,
	`simulationOnly` boolean NOT NULL DEFAULT true,
	`summary` text NOT NULL,
	`evidence` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
