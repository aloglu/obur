-- Saved meals are private to their owner (no admin access). Ownership never changes; items can only belong to a
-- meal of the same person (composite foreign key). Refreshing an item rewrites its snapshot, never its food link.
ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meals FORCE ROW LEVEL SECURITY;
CREATE POLICY saved_meals_owner ON saved_meals TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY saved_meals_own ON saved_meals FOR ALL TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON saved_meals TO obur_app;
GRANT UPDATE (name, revision, updated_at) ON saved_meals TO obur_app;
--> statement-breakpoint

ALTER TABLE saved_meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meal_items FORCE ROW LEVEL SECURITY;
CREATE POLICY saved_meal_items_owner ON saved_meal_items TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY saved_meal_items_own ON saved_meal_items FOR ALL TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON saved_meal_items TO obur_app;
GRANT UPDATE (food, unit, nutrients) ON saved_meal_items TO obur_app;
