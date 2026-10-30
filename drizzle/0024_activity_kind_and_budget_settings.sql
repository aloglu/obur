ALTER TABLE "activity_entries" ADD COLUMN "kind" text DEFAULT 'extra' NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_versions" ADD COLUMN "count_activity" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_versions" ADD COLUMN "at_goal" text DEFAULT 'keep' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_kind_valid" CHECK ("activity_entries"."kind" in ('extra', 'day_total'));--> statement-breakpoint
ALTER TABLE "goal_versions" ADD CONSTRAINT "goal_versions_at_goal_valid" CHECK ("goal_versions"."at_goal" in ('keep', 'maintain'));