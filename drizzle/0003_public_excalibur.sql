CREATE TABLE `investmentPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`name` varchar(120) NOT NULL,
	`maxConcentrationBps` int NOT NULL,
	`minReserveBps` int NOT NULL,
	`maxTransactionBps` int NOT NULL,
	`dailyMandateBps` int NOT NULL,
	`allowedAssets` json NOT NULL,
	`executionMode` enum('simulation','read_only') NOT NULL DEFAULT 'simulation',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investmentPolicies_id` PRIMARY KEY(`id`),
	CONSTRAINT `investmentPolicies_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `operatorActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`actionId` varchar(64) NOT NULL,
	`kind` enum('policy_updated','simulation_started','simulation_blocked','onchain_viewed','scope_checked','outcome_recorded','promotion_changed') NOT NULL,
	`status` enum('success','review','blocked') NOT NULL,
	`subject` varchar(160) NOT NULL,
	`detail` text NOT NULL,
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operatorActions_id` PRIMARY KEY(`id`),
	CONSTRAINT `operatorActions_actionId_unique` UNIQUE(`actionId`)
);
