-- Achievements are private to their person. The app keeps them in step with the person's records (inserts, removes
-- withdrawn ones, moves a date) and marks them celebrated.
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements FORCE ROW LEVEL SECURITY;
CREATE POLICY achievements_owner ON achievements TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY achievements_own ON achievements FOR ALL TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON achievements TO obur_app;
GRANT UPDATE (achieved_on, seen_at) ON achievements TO obur_app;
