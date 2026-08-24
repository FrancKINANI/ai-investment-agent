CREATE TABLE `outcomeRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`lineageId` varchar(64) NOT NULL,
	`runId` varchar(64),
	`expectedBps` int NOT NULL,
	`realizedBps` int,
	`attribution` json NOT NULL,
	`deviation` enum('on_track','underperforming','outperforming','inconclusive') NOT NULL DEFAULT 'inconclusive',
	`narrative` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outcomeRecords_id` PRIMARY KEY(`id`)
);
