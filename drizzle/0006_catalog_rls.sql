-- Catalog access (docs/design.md, "Food catalog and recipes"): shared foods are visible to everyone in the
-- household, private foods only to their owner. Only the creator, or an admin for shared foods, edits a food.
-- Child rows (nutrients, servings) follow their food. Nothing is deleted through the app; foods are archived.

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods FORCE ROW LEVEL SECURITY;
CREATE POLICY foods_owner ON foods TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY foods_select ON foods FOR SELECT TO obur_app, obur_worker
	USING (visibility = 'shared' OR owner_id = app_current_user_id());
CREATE POLICY foods_insert ON foods FOR INSERT TO obur_app
	WITH CHECK (owner_id = app_current_user_id() AND archived_at IS NULL AND version = 1);
CREATE POLICY foods_update ON foods FOR UPDATE TO obur_app
	USING (owner_id = app_current_user_id() OR (visibility = 'shared' AND app_current_user_is_admin()))
	-- An admin may edit a shared food but not make someone else's food private.
	WITH CHECK (owner_id = app_current_user_id() OR (visibility = 'shared' AND app_current_user_is_admin()));
GRANT SELECT, INSERT ON foods TO obur_app;
-- Ownership, origin and provenance never change after creation.
GRANT UPDATE (visibility, name, brand, search_key, basis, serving_label, serving_amount, serving_unit, barcode,
	source_meta, archived_at, version, updated_at) ON foods TO obur_app;
GRANT SELECT ON foods TO obur_worker;
--> statement-breakpoint

ALTER TABLE food_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_nutrients FORCE ROW LEVEL SECURITY;
CREATE POLICY food_nutrients_owner ON food_nutrients TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY food_nutrients_select ON food_nutrients FOR SELECT TO obur_app, obur_worker
	USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id));
CREATE POLICY food_nutrients_write ON food_nutrients FOR ALL TO obur_app
	USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id
		AND (f.owner_id = app_current_user_id() OR (f.visibility = 'shared' AND app_current_user_is_admin()))))
	WITH CHECK (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id
		AND (f.owner_id = app_current_user_id() OR (f.visibility = 'shared' AND app_current_user_is_admin()))));
GRANT SELECT, INSERT, UPDATE, DELETE ON food_nutrients TO obur_app;
GRANT SELECT ON food_nutrients TO obur_worker;
--> statement-breakpoint

ALTER TABLE food_servings ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_servings FORCE ROW LEVEL SECURITY;
CREATE POLICY food_servings_owner ON food_servings TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY food_servings_select ON food_servings FOR SELECT TO obur_app, obur_worker
	USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id));
CREATE POLICY food_servings_write ON food_servings FOR ALL TO obur_app
	USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id
		AND (f.owner_id = app_current_user_id() OR (f.visibility = 'shared' AND app_current_user_is_admin()))))
	WITH CHECK (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id
		AND (f.owner_id = app_current_user_id() OR (f.visibility = 'shared' AND app_current_user_is_admin()))));
GRANT SELECT, INSERT, UPDATE, DELETE ON food_servings TO obur_app;
GRANT SELECT ON food_servings TO obur_worker;
--> statement-breakpoint

-- Shared reference data: readable by everyone, changed only by migrations for now.
ALTER TABLE household_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_measures FORCE ROW LEVEL SECURITY;
CREATE POLICY household_measures_owner ON household_measures TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY household_measures_select ON household_measures FOR SELECT TO obur_app, obur_worker USING (true);
GRANT SELECT ON household_measures TO obur_app, obur_worker;
--> statement-breakpoint

-- Common Turkish household volume presets (docs/design.md, "Quantities and source values"). Conventional sizes,
-- not universal physical units; editable later. Volume only.
INSERT INTO household_measures (code, name, ml, position) VALUES
	('su_bardagi', 'Su bardağı', 200, 1),
	('cay_bardagi', 'Çay bardağı', 100, 2),
	('yemek_kasigi', 'Yemek kaşığı', 15, 3),
	('tatli_kasigi', 'Tatlı kaşığı', 10, 4),
	('cay_kasigi', 'Çay kaşığı', 5, 5);
