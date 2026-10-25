-- Data portability (docs/design.md, "Your data: export, import and deletion").

-- This installation's identity: readable by everyone, written once here.
ALTER TABLE installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation FORCE ROW LEVEL SECURITY;
CREATE POLICY installation_owner ON installation TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY installation_select ON installation FOR SELECT TO obur_app, obur_worker USING (true);
GRANT SELECT ON installation TO obur_app, obur_worker;
INSERT INTO installation DEFAULT VALUES;
--> statement-breakpoint

-- Import bookkeeping is private to the person who imported.
ALTER TABLE import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_files FORCE ROW LEVEL SECURITY;
CREATE POLICY import_files_owner ON import_files TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY import_files_select_own ON import_files FOR SELECT TO obur_app USING (user_id = app_current_user_id());
CREATE POLICY import_files_insert_own ON import_files FOR INSERT TO obur_app WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON import_files TO obur_app;
--> statement-breakpoint

ALTER TABLE import_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY import_identities_owner ON import_identities TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY import_identities_select_own ON import_identities FOR SELECT TO obur_app
	USING (user_id = app_current_user_id());
CREATE POLICY import_identities_insert_own ON import_identities FOR INSERT TO obur_app
	WITH CHECK (user_id = app_current_user_id());
GRANT SELECT, INSERT ON import_identities TO obur_app;
--> statement-breakpoint

-- The deletion list: admins read it; only app_delete_account writes it.
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletions FORCE ROW LEVEL SECURITY;
CREATE POLICY account_deletions_owner ON account_deletions TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY account_deletions_select_admin ON account_deletions FOR SELECT TO obur_app
	USING (app_current_user_is_admin());
GRANT SELECT ON account_deletions TO obur_app;
--> statement-breakpoint

-- Deletes an account in one transaction: the person themselves, or an active admin deleting someone else. Private
-- foods go with the account; shared foods stay under the household's stewardship without an owner unless the
-- person chooses to remove them too (other people's diary entries keep their own snapshots either way). Everything
-- else the person owns, including credentials, sessions and recovery codes, is removed by ON DELETE CASCADE. The
-- last active admin cannot be deleted. Errors: 42501 not allowed, OB001 last admin, OB002 no such account.
CREATE FUNCTION app_delete_account(p_account uuid, p_remove_shared_foods boolean) RETURNS void
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
	AS $$
DECLARE
	v_actor uuid := app_current_user_id();
	v_by text;
BEGIN
	IF v_actor IS NULL THEN
		RAISE EXCEPTION 'identity required' USING ERRCODE = '42501';
	END IF;
	-- Serializes concurrent deletions so the last-admin check cannot be raced.
	LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;
	IF v_actor = p_account THEN
		v_by := 'self';
	ELSIF EXISTS (SELECT 1 FROM users WHERE id = v_actor AND role = 'admin' AND disabled_at IS NULL) THEN
		v_by := 'admin';
	ELSE
		RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_account) THEN
		RAISE EXCEPTION 'no such account' USING ERRCODE = 'OB002';
	END IF;
	IF EXISTS (SELECT 1 FROM users WHERE id = p_account AND role = 'admin' AND disabled_at IS NULL)
		AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin' AND disabled_at IS NULL AND id <> p_account) THEN
		RAISE EXCEPTION 'last admin' USING ERRCODE = 'OB001';
	END IF;
	DELETE FROM foods WHERE owner_id = p_account AND (visibility = 'private' OR p_remove_shared_foods);
	DELETE FROM users WHERE id = p_account;
	INSERT INTO account_deletions (account_id, by) VALUES (p_account, v_by);
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_delete_account(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_delete_account(uuid, boolean) TO obur_app;
