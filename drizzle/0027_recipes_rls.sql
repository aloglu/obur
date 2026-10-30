-- Recipes and their ingredients are private to the recipe's owner (no admin access): others who can see a shared
-- recipe see only its food, with totals. A recipe belongs to a food of the same owner, and an ingredient to a recipe
-- of the same owner. Ownership never changes; editing replaces the ingredient rows.
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;
CREATE POLICY recipes_owner ON recipes TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY recipes_own ON recipes FOR ALL TO obur_app
	USING (owner_id = app_current_user_id())
	WITH CHECK (owner_id = app_current_user_id()
		AND EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.owner_id = app_current_user_id()));
GRANT SELECT, INSERT, DELETE ON recipes TO obur_app;
GRANT UPDATE (servings, cooked_yield_g) ON recipes TO obur_app;
--> statement-breakpoint

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY recipe_ingredients_owner ON recipe_ingredients TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY recipe_ingredients_own ON recipe_ingredients FOR ALL TO obur_app
	USING (owner_id = app_current_user_id())
	WITH CHECK (owner_id = app_current_user_id()
		AND EXISTS (SELECT 1 FROM recipes r WHERE r.food_id = recipe_id AND r.owner_id = app_current_user_id()));
GRANT SELECT, INSERT, DELETE ON recipe_ingredients TO obur_app;
