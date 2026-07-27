CREATE TABLE `api_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_usage` (
	`day` text PRIMARY KEY NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `claim_tags` (
	`claim_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`claim_id`, `tag_id`),
	FOREIGN KEY (`claim_id`) REFERENCES `claims`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`journalist_id` text NOT NULL,
	`headline` text NOT NULL,
	`player_name` text NOT NULL,
	`player_api_id` integer,
	`from_club_name` text,
	`from_club_api_id` integer,
	`to_club_name` text NOT NULL,
	`to_club_api_id` integer,
	`league` text,
	`confidence` integer NOT NULL,
	`transfer_window` text,
	`source_url` text,
	`notes` text,
	`claimed_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`outcome` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`journalist_id`) REFERENCES `journalists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_claims_journalist_status` ON `claims` (`journalist_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_claims_status_claimed` ON `claims` (`status`,`claimed_at`);--> statement-breakpoint
CREATE TABLE `journalists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`outlet` text,
	`avatar_color` text NOT NULL,
	`is_seeded` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);