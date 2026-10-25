-- Diary access: each person sees and changes only their own entries. Ownership, kind, the catalog link and the
-- captured zone never change after creation. Deletion goes to the trash (deleted_at) through the app; purging
-- expired trash is a separate, reviewed job.
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY diary_entries_owner ON diary_entries TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY diary_entries_select_own ON diary_entries FOR SELECT TO obur_app, obur_worker
	USING (user_id = app_current_user_id());
CREATE POLICY diary_entries_insert_own ON diary_entries FOR INSERT TO obur_app
	WITH CHECK (user_id = app_current_user_id() AND revision = 1 AND deleted_at IS NULL);
CREATE POLICY diary_entries_update_own ON diary_entries FOR UPDATE TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON diary_entries TO obur_app;
GRANT UPDATE (local_date, meal, eaten_at, amount, unit, description, nutrients, revision, updated_at, deleted_at)
	ON diary_entries TO obur_app;
GRANT SELECT ON diary_entries TO obur_worker;
