CREATE TABLE `day_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`rotation_order` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_templates_name_unique` ON `day_templates` (`name`);--> statement-breakpoint
CREATE TABLE `exercise_muscles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise_id` integer NOT NULL,
	`muscle_group_id` integer NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`metric` text DEFAULT 'weight_reps' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_name_unique` ON `exercises` (`name`);--> statement-breakpoint
CREATE TABLE `mobility_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`mobility_item_id` integer NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mobility_item_id`) REFERENCES `mobility_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mobility_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mobility_items_name_unique` ON `mobility_items` (`name`);--> statement-breakpoint
CREATE TABLE `muscle_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `muscle_groups_name_unique` ON `muscle_groups` (`name`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`uri` text NOT NULL,
	`taken_at` integer NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `session_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer,
	`day_name` text NOT NULL,
	`phase` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`notes` text,
	FOREIGN KEY (`template_id`) REFERENCES `day_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_exercise_id` integer NOT NULL,
	`set_number` integer NOT NULL,
	`weight` real,
	`reps` integer,
	`duration_sec` integer,
	`distance_m` integer,
	`note` text,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `session_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`notifications_enabled` integer DEFAULT true NOT NULL,
	`notification_day` integer DEFAULT 1 NOT NULL,
	`notification_hour` integer DEFAULT 9 NOT NULL,
	`notification_minute` integer DEFAULT 0 NOT NULL,
	`rest_seconds` integer DEFAULT 90 NOT NULL,
	`rest_sound_enabled` integer DEFAULT true NOT NULL,
	`deload_cycle_start` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000)
);
--> statement-breakpoint
CREATE TABLE `template_exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `day_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `template_mobility` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer NOT NULL,
	`mobility_item_id` integer NOT NULL,
	`target_reps` text,
	`hold_seconds` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `day_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mobility_item_id`) REFERENCES `mobility_items`(`id`) ON UPDATE no action ON DELETE cascade
);
