CREATE TABLE "water_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"zone" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"ml" numeric(7, 1) NOT NULL,
	CONSTRAINT "water_entries_ml_range" CHECK ("water_entries"."ml" > 0 and "water_entries"."ml" <= 10000),
	CONSTRAINT "water_entries_zone_format" CHECK ("water_entries"."zone" ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'),
	CONSTRAINT "water_entries_source_valid" CHECK ("water_entries"."source" in ('manual', 'loseit'))
);
--> statement-breakpoint
CREATE TABLE "weight_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"zone" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"measured_at" timestamp with time zone,
	"kg" numeric(6, 2) NOT NULL,
	CONSTRAINT "weight_entries_kg_range" CHECK ("weight_entries"."kg" > 0 and "weight_entries"."kg" < 700),
	CONSTRAINT "weight_entries_zone_format" CHECK ("weight_entries"."zone" ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'),
	CONSTRAINT "weight_entries_source_valid" CHECK ("weight_entries"."source" in ('manual', 'loseit'))
);
--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "water_entries_user_date_idx" ON "water_entries" USING btree ("user_id","local_date") WHERE "water_entries"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "weight_entries_user_date_idx" ON "weight_entries" USING btree ("user_id","local_date") WHERE "weight_entries"."deleted_at" is null;