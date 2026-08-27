ALTER TABLE `executionLedger` MODIFY COLUMN `eventType` enum('proposed','validated','submitted','acknowledged','partially_filled','filled','rejected','cancelled','unknown','reconciled') NOT NULL;--> statement-breakpoint
ALTER TABLE `liveOrderIntents` MODIFY COLUMN `status` enum('reserved','submitted','acknowledged','partially_filled','filled','cancelled','rejected','unknown') NOT NULL DEFAULT 'reserved';--> statement-breakpoint
ALTER TABLE `authorityControls` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `liveOrderApprovals` ADD `approvalDigest` varchar(64);--> statement-breakpoint
ALTER TABLE `liveOrderApprovals` ADD `canonicalPayload` text;--> statement-breakpoint
ALTER TABLE `liveOrderApprovals` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `approvalDigest` varchar(64);--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `canonicalPayload` text;--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `platformKeyId` varchar(64);--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `keyVersion` int;--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `mandateId` varchar(64);--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `mandateVersion` int;--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `authorityState` varchar(40);--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `authorityVersion` int;--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `venueClientOrderId` varchar(64);--> statement-breakpoint
ALTER TABLE `liveOrderIntents` ADD `venueOrderId` varchar(64);--> statement-breakpoint
ALTER TABLE `platformApiKeys` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `walletMandates` ADD `version` int DEFAULT 1 NOT NULL;