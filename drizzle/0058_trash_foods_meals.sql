ALTER TABLE "purged_records" DROP CONSTRAINT "purged_records_kind_valid";--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_meals" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "foods_trash_idx" ON "foods" USING btree ("owner_id","deleted_at") WHERE "foods"."deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "saved_meals_trash_idx" ON "saved_meals" USING btree ("user_id","deleted_at") WHERE "saved_meals"."deleted_at" is not null;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_deleted_archived" CHECK ("foods"."deleted_at" is null or "foods"."archived_at" is not null);--> statement-breakpoint
ALTER TABLE "purged_records" ADD CONSTRAINT "purged_records_kind_valid" CHECK ("purged_records"."kind" in ('diary', 'weight', 'water', 'activity', 'food', 'saved_meal'));