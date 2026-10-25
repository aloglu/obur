CREATE TABLE "activity_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"zone" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"kcal" integer NOT NULL,
	"note" text,
	"counts_toward_budget" boolean NOT NULL,
	CONSTRAINT "activity_entries_kcal_range" CHECK ("activity_entries"."kcal" > 0 and "activity_entries"."kcal" <= 10000),
	CONSTRAINT "activity_entries_note_length" CHECK ("activity_entries"."note" is null or char_length("activity_entries"."note") between 1 and 120),
	CONSTRAINT "activity_entries_zone_format" CHECK ("activity_entries"."zone" ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)*$'),
	CONSTRAINT "activity_entries_source_valid" CHECK ("activity_entries"."source" in ('manual', 'loseit')),
	CONSTRAINT "activity_entries_manual_counts" CHECK ("activity_entries"."source" <> 'manual' or "activity_entries"."counts_toward_budget")
);
--> statement-breakpoint
CREATE TABLE "day_completions" (
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_completions_user_id_local_date_pk" PRIMARY KEY("user_id","local_date"),
	CONSTRAINT "day_completions_source_valid" CHECK ("day_completions"."source" in ('manual', 'loseit'))
);
--> statement-breakpoint
CREATE TABLE "goal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"mode" text NOT NULL,
	"base_burn_kcal" integer,
	"deficit_kcal" integer DEFAULT 0 NOT NULL,
	"floor_kcal" integer DEFAULT 0 NOT NULL,
	"goal_weight_kg" numeric(6, 2),
	"rate_kg_per_week" numeric(4, 2),
	"protein_g_per_kg" numeric(4, 2),
	"protein_basis_kg" numeric(6, 2),
	"fat_share" numeric(3, 2),
	"inputs" jsonb NOT NULL,
	"calculation_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_versions_mode_valid" CHECK ("goal_versions"."mode" in ('calculated', 'manual', 'none')),
	CONSTRAINT "goal_versions_base_burn" CHECK (("goal_versions"."mode" = 'none') = ("goal_versions"."base_burn_kcal" is null)
				and ("goal_versions"."base_burn_kcal" is null or "goal_versions"."base_burn_kcal" between 500 and 10000)),
	CONSTRAINT "goal_versions_deficit_range" CHECK ("goal_versions"."deficit_kcal" between 0 and 1100),
	CONSTRAINT "goal_versions_floor_range" CHECK ("goal_versions"."floor_kcal" between 0 and 5000),
	CONSTRAINT "goal_versions_rate_range" CHECK ("goal_versions"."rate_kg_per_week" is null or "goal_versions"."rate_kg_per_week" between 0 and 1),
	CONSTRAINT "goal_versions_goal_weight_range" CHECK ("goal_versions"."goal_weight_kg" is null or "goal_versions"."goal_weight_kg" between 20 and 700),
	CONSTRAINT "goal_versions_protein_range" CHECK ("goal_versions"."protein_g_per_kg" is null or "goal_versions"."protein_g_per_kg" between 0 and 3),
	CONSTRAINT "goal_versions_fat_share_range" CHECK ("goal_versions"."fat_share" is null or "goal_versions"."fat_share" between 0.1 and 0.7)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"height_cm" numeric(5, 1),
	"birth_date" date,
	"sex" text,
	"body_fat_pct" numeric(4, 1),
	"waist_cm" numeric(5, 1),
	"pregnant" boolean DEFAULT false NOT NULL,
	"breastfeeding" boolean DEFAULT false NOT NULL,
	"decimal_mark" text DEFAULT ',' NOT NULL,
	"first_day_of_week" smallint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_height_range" CHECK ("profiles"."height_cm" is null or "profiles"."height_cm" between 50 and 260),
	CONSTRAINT "profiles_body_fat_range" CHECK ("profiles"."body_fat_pct" is null or "profiles"."body_fat_pct" between 2 and 75),
	CONSTRAINT "profiles_waist_range" CHECK ("profiles"."waist_cm" is null or "profiles"."waist_cm" between 30 and 250),
	CONSTRAINT "profiles_sex_valid" CHECK ("profiles"."sex" is null or "profiles"."sex" in ('female', 'male')),
	CONSTRAINT "profiles_birth_date_range" CHECK ("profiles"."birth_date" is null or "profiles"."birth_date" between '1900-01-01' and '2100-01-01'),
	CONSTRAINT "profiles_decimal_mark_valid" CHECK ("profiles"."decimal_mark" in (',', '.')),
	CONSTRAINT "profiles_first_day_valid" CHECK ("profiles"."first_day_of_week" between 1 and 7)
);
--> statement-breakpoint
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_completions" ADD CONSTRAINT "day_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_versions" ADD CONSTRAINT "goal_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_entries_user_date_idx" ON "activity_entries" USING btree ("user_id","local_date") WHERE "activity_entries"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "goal_versions_user_effective_idx" ON "goal_versions" USING btree ("user_id","effective_from","created_at");