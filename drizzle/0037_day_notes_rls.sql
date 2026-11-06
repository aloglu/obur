-- A day note is private to its owner; admins and the worker have no access.
ALTER TABLE day_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY day_notes_owner ON day_notes TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY day_notes_select_own ON day_notes FOR SELECT TO obur_app USING (user_id = app_current_user_id());
CREATE POLICY day_notes_insert_own ON day_notes FOR INSERT TO obur_app WITH CHECK (user_id = app_current_user_id());
CREATE POLICY day_notes_update_own ON day_notes FOR UPDATE TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON day_notes TO obur_app;
GRANT UPDATE (text, typed_at) ON day_notes TO obur_app;
