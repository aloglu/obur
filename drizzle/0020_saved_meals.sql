CREATE TABLE "saved_meal_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"saved_meal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"food_id" uuid,
	"food" jsonb,
	"amount" numeric(12, 4),
	"unit" jsonb,
	"description" text,
	"nutrients" jsonb NOT NULL,
	CONSTRAINT "saved_meal_items_position" UNIQUE("saved_meal_id","position"),
	CONSTRAINT "saved_meal_items_kind_valid" CHECK ("saved_meal_items"."kind" in ('food', 'quick')),
	CONSTRAINT "saved_meal_items_shape" CHECK (("saved_meal_items"."kind" = 'food' and "saved_meal_items"."food" is not null and "saved_meal_items"."amount" > 0 and "saved_meal_items"."unit" is not null)
				or ("saved_meal_items"."kind" = 'quick' and "saved_meal_items"."food" is null and "saved_meal_items"."amount" is null and "saved_meal_items"."unit" is null
					and "saved_meal_items"."food_id" is null and ("saved_meal_items"."nutrients" -> 'energy_kcal') is not null)),
	CONSTRAINT "saved_meal_items_description_length" CHECK ("saved_meal_items"."description" is null or char_length("saved_meal_items"."description") between 1 and 200),
	CONSTRAINT "saved_meal_items_nutrients_object" CHECK (jsonb_typeof("saved_meal_items"."nutrients") = 'object'),
	CONSTRAINT "saved_meal_items_position_range" CHECK ("saved_meal_items"."position" between 0 and 99)
);
--> statement-breakpoint
CREATE TABLE "saved_meals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_meals_id_user" UNIQUE("id","user_id"),
	CONSTRAINT "saved_meals_name_length" CHECK (char_length("saved_meals"."name") between 1 and 120),
	CONSTRAINT "saved_meals_revision_positive" CHECK ("saved_meals"."revision" >= 1)
);
--> statement-breakpoint
ALTER TABLE "saved_meal_items" ADD CONSTRAINT "saved_meal_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meal_items" ADD CONSTRAINT "saved_meal_items_meal_owner" FOREIGN KEY ("saved_meal_id","user_id") REFERENCES "public"."saved_meals"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meals" ADD CONSTRAINT "saved_meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_meal_items_user_idx" ON "saved_meal_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_meals_user_idx" ON "saved_meals" USING btree ("user_id","updated_at");