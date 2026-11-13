ALTER TABLE "household_settings" ADD COLUMN "update_check" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "household_settings" ADD COLUMN "latest_version" text;--> statement-breakpoint
ALTER TABLE "household_settings" ADD COLUMN "latest_checked_at" timestamp with time zone;