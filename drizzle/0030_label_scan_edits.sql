CREATE TABLE "label_scan_edits" (
	"food_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"proposed" smallint NOT NULL,
	"changed" smallint NOT NULL,
	"removed" smallint NOT NULL,
	"added" smallint NOT NULL,
	"basis_known" boolean NOT NULL,
	"basis_changed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "label_scan_edits_counts" CHECK ("label_scan_edits"."proposed" between 0 and 100 and "label_scan_edits"."changed" >= 0 and "label_scan_edits"."removed" >= 0
				and "label_scan_edits"."changed" + "label_scan_edits"."removed" <= "label_scan_edits"."proposed" and "label_scan_edits"."added" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "label_scan_edits" ADD CONSTRAINT "label_scan_edits_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_scan_edits" ADD CONSTRAINT "label_scan_edits_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "label_scan_edits_owner_id_idx" ON "label_scan_edits" USING btree ("owner_id");