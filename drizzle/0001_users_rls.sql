-- Identity for row-level security. NULL (deny) when no identity is set; a malformed value raises an error.
CREATE FUNCTION app_current_user_id() RETURNS uuid
	LANGUAGE sql STABLE PARALLEL SAFE
	AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_user_id() TO obur_app, obur_worker;
--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- A person sees and edits only their own row. Role and disabled state change only through reviewed admin paths.
CREATE POLICY users_select_self ON users FOR SELECT TO obur_app, obur_worker
	USING (id = app_current_user_id());
-- Drizzle names every column in an INSERT (DEFAULT for omitted ones), which defeats column-level INSERT
-- grants; the policy therefore pins the values a person may create their own row with.
CREATE POLICY users_insert_self ON users FOR INSERT TO obur_app
	WITH CHECK (id = app_current_user_id() AND role = 'member' AND disabled_at IS NULL);
CREATE POLICY users_update_self ON users FOR UPDATE TO obur_app
	USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id());
--> statement-breakpoint
GRANT SELECT ON users TO obur_app, obur_worker;
GRANT INSERT ON users TO obur_app;
GRANT UPDATE (display_name) ON users TO obur_app;
