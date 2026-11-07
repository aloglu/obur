ALTER TABLE "achievements" DROP CONSTRAINT "achievements_level";--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_level" CHECK (("achievements"."kind" in ('weight', 'goal') and "achievements"."level" ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$')
				or ("achievements"."kind" = 'streak' and "achievements"."level" ~ '^[0-9]{1,4}$')
				or ("achievements"."kind" = 'first' and "achievements"."level" in ('weigh_in', 'day_logged', 'complete_day', 'scan', 'voice', 'recipe')));