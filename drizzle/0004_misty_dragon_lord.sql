CREATE TABLE `template_exercise_warmups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_exercise_id` integer NOT NULL,
	`percent` real,
	`fixed_weight` real,
	`reps` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`template_exercise_id`) REFERENCES `template_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `exercises` ADD `rest_seconds` integer;--> statement-breakpoint
ALTER TABLE `sets` ADD `is_warmup` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `template_exercises` ADD `target_sets` integer;--> statement-breakpoint
ALTER TABLE `template_exercises` ADD `tempo` text;--> statement-breakpoint
ALTER TABLE `template_exercises` ADD `rest_seconds` integer;