CREATE TABLE "food_nutrients" (
	"food_id" uuid NOT NULL,
	"code" text NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"qualifier" text NOT NULL,
	CONSTRAINT "food_nutrients_food_code" UNIQUE("food_id","code"),
	CONSTRAINT "food_nutrients_code_valid" CHECK ("food_nutrients"."code" in ('energy_kcal', 'energy_kj', 'fat', 'saturated_fat', 'carbohydrate_excl_fibre', 'carbohydrate_total', 'sugars', 'fibre', 'protein', 'salt', 'sodium', 'polyols', 'starch', 'monounsaturated_fat', 'polyunsaturated_fat', 'trans_fat', 'cholesterol', 'calcium', 'potassium', 'iron')),
	CONSTRAINT "food_nutrients_qualifier_valid" CHECK ("food_nutrients"."qualifier" in ('reported', 'less_than', 'derived', 'estimate')),
	CONSTRAINT "food_nutrients_value_non_negative" CHECK ("food_nutrients"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "food_servings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"unit" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "food_servings_name_length" CHECK (char_length("food_servings"."name") between 1 and 60),
	CONSTRAINT "food_servings_amount_positive" CHECK ("food_servings"."amount" > 0),
	CONSTRAINT "food_servings_unit_valid" CHECK ("food_servings"."unit" in ('g', 'ml')),
	CONSTRAINT "food_servings_source_valid" CHECK ("food_servings"."source" in ('label', 'user', 'estimate'))
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"visibility" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"search_key" text NOT NULL,
	"basis" text NOT NULL,
	"serving_label" text,
	"serving_amount" numeric(12, 4),
	"serving_unit" text,
	"barcode" text,
	"origin" text NOT NULL,
	"source_meta" jsonb,
	"derived_from" uuid,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_private_has_owner" CHECK ("foods"."visibility" = 'shared' or "foods"."owner_id" is not null),
	CONSTRAINT "foods_name_length" CHECK (char_length("foods"."name") between 1 and 200),
	CONSTRAINT "foods_brand_length" CHECK ("foods"."brand" is null or char_length("foods"."brand") between 1 and 120),
	CONSTRAINT "foods_serving_basis" CHECK (("foods"."basis" = 'serving') = ("foods"."serving_label" is not null)),
	CONSTRAINT "foods_serving_size" CHECK (("foods"."serving_amount" is null) = ("foods"."serving_unit" is null)
				and ("foods"."serving_amount" is null or ("foods"."basis" = 'serving' and "foods"."serving_amount" > 0))),
	CONSTRAINT "foods_barcode_digits" CHECK ("foods"."barcode" is null or "foods"."barcode" ~ '^[0-9]{8,14}$'),
	CONSTRAINT "foods_version_positive" CHECK ("foods"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "household_measures" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"ml" numeric(12, 4) NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "household_measures_ml_positive" CHECK ("household_measures"."ml" > 0)
);
--> statement-breakpoint
ALTER TABLE "food_nutrients" ADD CONSTRAINT "food_nutrients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_servings" ADD CONSTRAINT "food_servings_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_derived_from_foods_id_fk" FOREIGN KEY ("derived_from") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_servings_food_id_idx" ON "food_servings" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "foods_owner_id_idx" ON "foods" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "foods_barcode_idx" ON "foods" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "foods_search_key_trgm_idx" ON "foods" USING gin ("search_key" gin_trgm_ops);