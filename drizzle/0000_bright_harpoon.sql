CREATE TABLE `artwork_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`page_id` integer NOT NULL,
	`drawing_data` text NOT NULL,
	`completion_percent` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `coloring_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_artwork_progress_user_page` ON `artwork_progress` (`user_id`,`page_id`);--> statement-breakpoint
CREATE INDEX `idx_artwork_progress_user` ON `artwork_progress` (`user_id`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_asset` text,
	`theme` text NOT NULL,
	`age_min` integer NOT NULL,
	`age_max` integer NOT NULL,
	`price_cents` integer DEFAULT 999 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`is_free` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_slug_unique` ON `books` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_books_published_sort` ON `books` (`is_published`,`sort_order`);--> statement-breakpoint
CREATE TABLE `coloring_pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`svg_asset` text,
	`preview_asset` text,
	`printable_asset` text,
	`is_preview` integer DEFAULT false NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_coloring_pages_book_slug` ON `coloring_pages` (`book_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_coloring_pages_book_sort` ON `coloring_pages` (`book_id`,`sort_order`);