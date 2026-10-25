-- Weight and water: each person sees and changes only their own readings. Ownership, zone and source never
-- change; deletion goes to the trash (deleted_at) through the app.
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY weight_entries_owner ON weight_entries TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY weight_entries_select_own ON weight_entries FOR SELECT TO obur_app, obur_worker
	USING (user_id = app_current_user_id());
CREATE POLICY weight_entries_insert_own ON weight_entries FOR INSERT TO obur_app
	WITH CHECK (user_id = app_current_user_id() AND revision = 1 AND deleted_at IS NULL);
CREATE POLICY weight_entries_update_own ON weight_entries FOR UPDATE TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON weight_entries TO obur_app;
GRANT UPDATE (local_date, measured_at, kg, revision, updated_at, deleted_at) ON weight_entries TO obur_app;
GRANT SELECT ON weight_entries TO obur_worker;
--> statement-breakpoint

ALTER TABLE water_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY water_entries_owner ON water_entries TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY water_entries_select_own ON water_entries FOR SELECT TO obur_app, obur_worker
	USING (user_id = app_current_user_id());
CREATE POLICY water_entries_insert_own ON water_entries FOR INSERT TO obur_app
	WITH CHECK (user_id = app_current_user_id() AND revision = 1 AND deleted_at IS NULL);
CREATE POLICY water_entries_update_own ON water_entries FOR UPDATE TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON water_entries TO obur_app;
GRANT UPDATE (local_date, ml, revision, updated_at, deleted_at) ON water_entries TO obur_app;
GRANT SELECT ON water_entries TO obur_worker;
