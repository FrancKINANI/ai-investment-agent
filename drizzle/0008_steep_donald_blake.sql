CREATE TABLE `bindingChangeRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`requestId` varchar(64) NOT NULL,
	`capabilityId` varchar(120) NOT NULL,
	`roleKeys` json NOT NULL,
	`permission` enum('research-only','simulation-only') NOT NULL,
	`rationale` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewerUserId` int,
	`reviewNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bindingChangeRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `bindingChangeRequests_requestId_unique` UNIQUE(`requestId`)
);
