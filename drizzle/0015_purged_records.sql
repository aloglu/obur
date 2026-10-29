CREATE TABLE "purged_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"purged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purged_records_kind_valid" CHECK ("purged_records"."kind" in ('diary', 'weight', 'water', 'activity'))
);
--> statement-breakpoint
ALTER TABLE "purged_records" ADD CONSTRAINT "purged_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;