CREATE TABLE `awarenessRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`layer` enum('action','justification','result','evolutionary') NOT NULL,
	`subject` varchar(160) NOT NULL,
	`runId` varchar(64),
	`evidence` json NOT NULL,
	`summary` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `awarenessRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategyEvaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lineageId` varchar(64) NOT NULL,
	`version` varchar(64) NOT NULL,
	`gateResult` enum('pass','review','block') NOT NULL,
	`simulationPassed` boolean NOT NULL DEFAULT false,
	`coverage` int NOT NULL DEFAULT 0,
	`complexityPenalty` int NOT NULL DEFAULT 0,
	`rationale` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `strategyEvaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategyLineages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lineageId` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`stage` enum('research','simulation','decision','retired') NOT NULL DEFAULT 'research',
	`generation` int NOT NULL DEFAULT 1,
	`parentVersion` varchar(64),
	`scores` json NOT NULL,
	`rationale` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategyLineages_id` PRIMARY KEY(`id`)
);
