CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"meal" text NOT NULL,
	"zone" text NOT NULL,
	"eaten_at" timestamp with time zone,
	"kind" text NOT NULL,
	"food_id" uuid,
	"food" jsonb,
	"amount" numeric(12, 4),
	"unit" jsonb,
	"description" text,
	"nutrients" jsonb NOT NULL,
	"energy_kcal" numeric(12, 4) GENERATED ALWAYS AS ((nutrients -> 'energy_kcal' ->> 'value')::numeric) STORED,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "diary_entries_meal_valid" CHECK ("diary_entries"."meal" in ('breakfast', 'lunch', 'dinner', 'snacks')),
	CONSTRAINT "diary_entries_kind_valid" CHECK ("diary_entries"."kind" in ('food', 'quick')),
	CONSTRAINT "diary_entries_shape" CHECK (("diary_entries"."kind" = 'food' and "diary_entries"."food" is not null and "diary_entries"."amount" > 0 and "diary_entries"."unit" is not null)
				or ("diary_entries"."kind" = 'quick' and "diary_entries"."food" is null and "diary_entries"."amount" is null and "diary_entries"."unit" is null
					and "diary_entries"."food_id" is null and ("diary_entries"."nutrients" -> 'energy_kcal') is not null)),
	CONSTRAINT "diary_entries_description_length" CHECK ("diary_entries"."description" is null or char_length("diary_entries"."description") between 1 and 200),
	CONSTRAINT "diary_entries_nutrients_object" CHECK (jsonb_typeof("diary_entries"."nutrients") = 'object'),
	CONSTRAINT "diary_entries_energy_non_negative" CHECK ("diary_entries"."energy_kcal" is null or "diary_entries"."energy_kcal" >= 0),
	CONSTRAINT "diary_entries_zone_format" CHECK ("diary_entries"."zone" ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'),
	CONSTRAINT "diary_entries_revision_positive" CHECK ("diary_entries"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diary_entries_user_date_idx" ON "diary_entries" USING btree ("user_id","local_date") WHERE "diary_entries"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "diary_entries_user_food_idx" ON "diary_entries" USING btree ("user_id","food_id","created_at");