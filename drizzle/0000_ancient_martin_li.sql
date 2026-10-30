CREATE TABLE `affiliates` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`event_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`cpf` varchar(14) NOT NULL,
	`email` varchar(320),
	`phone` varchar(30),
	`code` varchar(32) NOT NULL,
	`commission_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
	`status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliates_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`key_hash` varchar(64) NOT NULL,
	`window_started_at` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_rate_limits_key_hash` PRIMARY KEY(`key_hash`)
);
--> statement-breakpoint
CREATE TABLE `email_auth_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`user_id` int,
	`password_hash` varchar(255) NOT NULL,
	`verified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_auth_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_auth_accounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `email_auth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`purpose` enum('VERIFY_EMAIL','RESET_PASSWORD') NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_auth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_auth_tokens_token_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` varchar(36) NOT NULL,
	`organization_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`banner_url` text,
	`banner_storage_key` varchar(500),
	`description` text,
	`location_name` varchar(255),
	`event_date` timestamp NOT NULL,
	`review_note` text,
	`status` enum('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED','FINISHED') NOT NULL DEFAULT 'DRAFT',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `google_auth_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`google_sub` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `google_auth_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_auth_identities_sub_unique` UNIQUE(`google_sub`)
);
--> statement-breakpoint
CREATE TABLE `inventory_reservations` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`lot_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`status` enum('HELD','CONSUMED','RELEASED') NOT NULL DEFAULT 'HELD',
	`expires_at` timestamp NOT NULL,
	`consumed_at` timestamp,
	`released_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `reservation_order_lot_unique` UNIQUE(`order_id`,`lot_id`)
);
--> statement-breakpoint
CREATE TABLE `lots` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`title` varchar(100) NOT NULL,
	`description` text,
	`price` decimal(12,2) NOT NULL,
	`total_quantity` int NOT NULL,
	`available_quantity` int NOT NULL,
	`status` enum('ACTIVE','PAUSED','SOLD_OUT') NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`lot_id` varchar(36) NOT NULL,
	`holder_name` varchar(255) NOT NULL,
	`holder_cpf` varchar(14) NOT NULL,
	`holder_email` varchar(320) NOT NULL,
	`holder_phone` varchar(30) NOT NULL,
	`holder_instagram` varchar(100),
	`unit_amount` decimal(12,2) NOT NULL,
	`commission_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`affiliate_id` varchar(36),
	`buyer_name` varchar(255) NOT NULL,
	`buyer_cpf` varchar(14) NOT NULL,
	`buyer_email` varchar(320) NOT NULL,
	`buyer_phone` varchar(30) NOT NULL,
	`buyer_instagram` varchar(100),
	`total_amount` decimal(12,2) NOT NULL,
	`gateway_fee_amount` decimal(12,2),
	`status` enum('PENDING','APPROVED','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`infinitepay_checkout_url` text,
	`order_nsu` varchar(80) NOT NULL,
	`transaction_nsu` varchar(120),
	`invoice_slug` varchar(120),
	`capture_method` varchar(32),
	`voucher_token_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`payment_verified_at` timestamp,
	`refunded_at` timestamp,
	`terms_accepted_at` timestamp,
	`terms_version` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_nsu_unique` UNIQUE(`order_nsu`),
	CONSTRAINT `orders_transaction_nsu_unique` UNIQUE(`transaction_nsu`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`document` varchar(20) NOT NULL,
	`application` json,
	`profile_draft` json,
	`profile_published` json,
	`profile_status` enum('DRAFT','PENDING_REVIEW','REJECTED','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
	`profile_published_at` timestamp,
	`review_note` text,
	`profile_review_note` text,
	`gateway_credential_ciphertext` text,
	`gateway_credential_configured_at` timestamp,
	`status` enum('PENDING_REVIEW','ACTIVE','INACTIVE','REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_document_unique` UNIQUE(`document`)
);
--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` varchar(36) NOT NULL,
	`event_key` varchar(180) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`status` enum('RECEIVED','VERIFIED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`processed_at` timestamp,
	CONSTRAINT `payment_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_event_key_unique` UNIQUE(`event_key`)
);
--> statement-breakpoint
CREATE TABLE `security_audit_log` (
	`id` varchar(36) NOT NULL,
	`actor_type` enum('USER','SYSTEM') NOT NULL,
	`actor_user_id` int,
	`ip` varchar(45),
	`action` varchar(64) NOT NULL,
	`scope_type` varchar(32) NOT NULL,
	`scope_id` varchar(36),
	`summary` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `security_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_access` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`organization_id` varchar(36),
	`event_id` varchar(36),
	`role` enum('SUPER_ADMIN','ORGANIZER','STAFF_PORTARIA') NOT NULL,
	`status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_audit_log` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`ticket_id` varchar(36),
	`staff_access_id` varchar(36),
	`action` varchar(48) NOT NULL,
	`detail` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`order_item_id` varchar(36) NOT NULL,
	`lot_id` varchar(36) NOT NULL,
	`ticket_code` varchar(50) NOT NULL,
	`verification_hash` varchar(50) NOT NULL,
	`status` enum('VALID','USED','CANCELLED') NOT NULL DEFAULT 'VALID',
	`used_at` timestamp,
	`used_by_staff_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_code_unique` UNIQUE(`ticket_code`),
	CONSTRAINT `tickets_order_item_unique` UNIQUE(`order_item_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`password_session_version` int NOT NULL DEFAULT 0,
	`terms_accepted_at` timestamp,
	`terms_version` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `affiliates` ADD CONSTRAINT `affiliates_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `affiliates` ADD CONSTRAINT `affiliates_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_auth_accounts` ADD CONSTRAINT `email_auth_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_auth_tokens` ADD CONSTRAINT `email_auth_tokens_account_id_email_auth_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `email_auth_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `google_auth_identities` ADD CONSTRAINT `google_auth_identities_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_lot_id_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lots` ADD CONSTRAINT `lots_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_lot_id_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_webhook_events` ADD CONSTRAINT `payment_webhook_events_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_access` ADD CONSTRAINT `staff_access_organization_id_organizations_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_access` ADD CONSTRAINT `staff_access_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_audit_log` ADD CONSTRAINT `ticket_audit_log_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_audit_log` ADD CONSTRAINT `ticket_audit_log_ticket_id_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_lot_id_lots_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `lots`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `affiliates_organization_idx` ON `affiliates` (`organization_id`);--> statement-breakpoint
CREATE INDEX `affiliates_event_idx` ON `affiliates` (`event_id`);--> statement-breakpoint
CREATE INDEX `email_auth_accounts_user_idx` ON `email_auth_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_auth_tokens_account_purpose_idx` ON `email_auth_tokens` (`account_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `events_organization_idx` ON `events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `google_auth_identities_user_idx` ON `google_auth_identities` (`user_id`);--> statement-breakpoint
CREATE INDEX `google_auth_identities_email_idx` ON `google_auth_identities` (`email`);--> statement-breakpoint
CREATE INDEX `reservation_expiry_idx` ON `inventory_reservations` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `lots_event_idx` ON `lots` (`event_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_lot_idx` ON `order_items` (`lot_id`);--> statement-breakpoint
CREATE INDEX `orders_event_idx` ON `orders` (`event_id`);--> statement-breakpoint
CREATE INDEX `orders_status_expiry_idx` ON `orders` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `orders_affiliate_idx` ON `orders` (`affiliate_id`);--> statement-breakpoint
CREATE INDEX `webhook_order_idx` ON `payment_webhook_events` (`order_id`);--> statement-breakpoint
CREATE INDEX `security_audit_scope_idx` ON `security_audit_log` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE INDEX `security_audit_created_idx` ON `security_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `staff_user_idx` ON `staff_access` (`user_id`);--> statement-breakpoint
CREATE INDEX `staff_organization_idx` ON `staff_access` (`organization_id`);--> statement-breakpoint
CREATE INDEX `staff_event_idx` ON `staff_access` (`event_id`);--> statement-breakpoint
CREATE INDEX `ticket_audit_event_idx` ON `ticket_audit_log` (`event_id`);--> statement-breakpoint
CREATE INDEX `ticket_audit_ticket_idx` ON `ticket_audit_log` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_audit_created_idx` ON `ticket_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `tickets_order_idx` ON `tickets` (`order_id`);--> statement-breakpoint
CREATE INDEX `tickets_lot_idx` ON `tickets` (`lot_id`);