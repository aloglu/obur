ALTER TABLE "foods" DROP CONSTRAINT "foods_private_has_owner";--> statement-breakpoint
ALTER TABLE "foods" DROP CONSTRAINT "foods_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" DROP COLUMN "visibility";--> statement-breakpoint
ALTER TABLE "account_deletions" DROP COLUMN "removed_shared_foods";--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_unless_curated" CHECK (("foods"."owner_id" is null) = ("foods"."origin" = 'curated'));