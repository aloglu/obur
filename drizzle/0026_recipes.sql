CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"food_id" uuid,
	"food" jsonb NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"unit" jsonb NOT NULL,
	"nutrients" jsonb NOT NULL,
	CONSTRAINT "recipe_ingredients_position" UNIQUE("recipe_id","position"),
	CONSTRAINT "recipe_ingredients_position_range" CHECK ("recipe_ingredients"."position" between 0 and 99),
	CONSTRAINT "recipe_ingredients_amount_positive" CHECK ("recipe_ingredients"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"food_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"servings" numeric(8, 2) NOT NULL,
	"cooked_yield_g" numeric(10, 2),
	CONSTRAINT "recipes_servings_range" CHECK ("recipes"."servings" > 0 and "recipes"."servings" <= 1000),
	CONSTRAINT "recipes_cooked_yield_range" CHECK ("recipes"."cooked_yield_g" is null or ("recipes"."cooked_yield_g" > 0 and "recipes"."cooked_yield_g" <= 100000))
);
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_food_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("food_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_ingredients_owner_id_idx" ON "recipe_ingredients" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_food_id_idx" ON "recipe_ingredients" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "recipes_owner_id_idx" ON "recipes" USING btree ("owner_id");