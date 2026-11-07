ALTER TABLE "profiles" ADD COLUMN "theme_mode" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "palette" text DEFAULT 'pazar' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "time_format" text DEFAULT 'device' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "scan_log_after" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "weight_view" text DEFAULT 'readings' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "voice_off_seen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "hold_hint_seen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "preferences_saved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_theme_mode_valid" CHECK ("profiles"."theme_mode" in ('system', 'light', 'dark'));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_palette_valid" CHECK ("profiles"."palette" in ('pazar', 'sade', 'zerde', 'patlican', 'zeytin', 'disko', 'kaset', 'sinyal'));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_time_format_valid" CHECK ("profiles"."time_format" in ('device', '24', '12'));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_weight_view_valid" CHECK ("profiles"."weight_view" in ('readings', 'trend'));