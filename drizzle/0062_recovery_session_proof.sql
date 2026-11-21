ALTER TABLE "sessions" ADD COLUMN "recovery_code_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "recovery_link_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_recovery_code_id_recovery_codes_id_fk" FOREIGN KEY ("recovery_code_id") REFERENCES "public"."recovery_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_recovery_link_id_recovery_links_id_fk" FOREIGN KEY ("recovery_link_id") REFERENCES "public"."recovery_links"("id") ON DELETE cascade ON UPDATE no action;