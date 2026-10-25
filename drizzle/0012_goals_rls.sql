-- Profiles, targets, activity and day completion are private to their owner; admins have no access.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY profiles_owner ON profiles TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY profiles_select_own ON profiles FOR SELECT TO obur_app, obur_worker USING (user_id = app_current_user_id());
CREATE POLICY profiles_insert_own ON profiles FOR INSERT TO obur_app WITH CHECK (user_id = app_current_user_id());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON profiles TO obur_app;
GRANT UPDATE (height_cm, birth_date, sex, body_fat_pct, waist_cm, pregnant, breastfeeding, decimal_mark,
	first_day_of_week, updated_at) ON profiles TO obur_app;
GRANT SELECT ON profiles TO obur_worker;
--> statement-breakpoint

-- Target versions are append-only: corrections are new rows, so history stays auditable.
ALTER TABLE goal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY goal_versions_owner ON goal_versions TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY goal_versions_select_own ON goal_versions FOR SELECT TO obur_app, obur_worker USING (user_id = app_current_user_id());
CREATE POLICY goal_versions_insert_own ON goal_versions FOR INSERT TO obur_app WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON goal_versions TO obur_app;
GRANT SELECT ON goal_versions TO obur_worker;
--> statement-breakpoint

ALTER TABLE activity_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY activity_entries_owner ON activity_entries TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY activity_entries_select_own ON activity_entries FOR SELECT TO obur_app, obur_worker USING (user_id = app_current_user_id());
CREATE POLICY activity_entries_insert_own ON activity_entries FOR INSERT TO obur_app
	WITH CHECK (user_id = app_current_user_id() AND revision = 1 AND deleted_at IS NULL);
CREATE POLICY activity_entries_update_own ON activity_entries FOR UPDATE TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON activity_entries TO obur_app;
GRANT UPDATE (local_date, kcal, note, revision, updated_at, deleted_at) ON activity_entries TO obur_app;
GRANT SELECT ON activity_entries TO obur_worker;
--> statement-breakpoint

ALTER TABLE day_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_completions FORCE ROW LEVEL SECURITY;
CREATE POLICY day_completions_owner ON day_completions TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY day_completions_select_own ON day_completions FOR SELECT TO obur_app, obur_worker USING (user_id = app_current_user_id());
CREATE POLICY day_completions_insert_own ON day_completions FOR INSERT TO obur_app WITH CHECK (user_id = app_current_user_id());
CREATE POLICY day_completions_delete_own ON day_completions FOR DELETE TO obur_app USING (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON day_completions TO obur_app;
GRANT SELECT ON day_completions TO obur_worker;
