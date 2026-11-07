-- Remote models for Speak and Scan (docs/design.md, "Remote models for Speak and Scan").
-- Keys, choices and usage belong to their owner alone: no admin policy, no worker access, never exported.
ALTER TABLE model_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY model_keys_owner ON model_keys TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY model_keys_own ON model_keys FOR ALL TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON model_keys TO obur_app;
GRANT UPDATE (ciphertext, last4, checked_at) ON model_keys TO obur_app;
--> statement-breakpoint

ALTER TABLE model_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_choices FORCE ROW LEVEL SECURITY;
CREATE POLICY model_choices_owner ON model_choices TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY model_choices_own ON model_choices FOR ALL TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON model_choices TO obur_app;
GRANT UPDATE (speak, scan, speak_allowed_at, scan_allowed_at, updated_at) ON model_choices TO obur_app;
--> statement-breakpoint

ALTER TABLE model_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY model_usage_owner ON model_usage TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY model_usage_own ON model_usage FOR ALL TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON model_usage TO obur_app;
GRANT UPDATE (count) ON model_usage TO obur_app;
--> statement-breakpoint

-- The household's settings: everyone signed in reads them; only an active admin changes them.
INSERT INTO household_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE household_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY household_settings_owner ON household_settings TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY household_settings_read ON household_settings FOR SELECT TO obur_app USING (true);
CREATE POLICY household_settings_admin ON household_settings FOR UPDATE TO obur_app
	USING (app_current_user_is_admin()) WITH CHECK (app_current_user_is_admin());
GRANT SELECT ON household_settings TO obur_app;
GRANT UPDATE (personal_keys, updated_at) ON household_settings TO obur_app;
