ALTER TABLE "goal_versions" DROP CONSTRAINT "goal_versions_fat_share_range";--> statement-breakpoint
ALTER TABLE "goal_versions" ADD COLUMN "macro_mode" text DEFAULT 'balanced' NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_versions" ADD COLUMN "protein_share" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "goal_versions" ADD COLUMN "carb_share" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "goal_versions" ADD CONSTRAINT "goal_versions_macro_mode_valid" CHECK ("goal_versions"."macro_mode" in ('balanced', 'percent'));--> statement-breakpoint
ALTER TABLE "goal_versions" ADD CONSTRAINT "goal_versions_macro_shares" CHECK (case when "goal_versions"."macro_mode" = 'percent'
				then coalesce("goal_versions"."protein_share" between 0 and 1 and "goal_versions"."carb_share" between 0 and 1
					and "goal_versions"."protein_share" + "goal_versions"."carb_share" + "goal_versions"."fat_share" = 1, false)
				else "goal_versions"."protein_share" is null and "goal_versions"."carb_share" is null end);--> statement-breakpoint
ALTER TABLE "goal_versions" ADD CONSTRAINT "goal_versions_fat_share_range" CHECK ("goal_versions"."fat_share" is null or ("goal_versions"."fat_share" between 0 and 1
				and ("goal_versions"."macro_mode" = 'percent' or "goal_versions"."fat_share" between 0.1 and 0.7)));