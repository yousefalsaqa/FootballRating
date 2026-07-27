ALTER TABLE `journalists` ADD `handle` text;--> statement-breakpoint
CREATE UNIQUE INDEX `journalists_handle_unique` ON `journalists` (`handle`);