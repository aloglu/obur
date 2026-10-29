-- As in 0014, and the deletion list now records whether shared foods were removed too.
CREATE OR REPLACE FUNCTION app_delete_account(p_account uuid, p_remove_shared_foods boolean) RETURNS void
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
	INSERT INTO account_deletions (account_id, by, removed_shared_foods)
		VALUES (p_account, v_by, p_remove_shared_foods);
END
$$;
--> statement-breakpoint

-- After a restore from backup: deletes again an account that was deleted after the backup was taken, from the
-- operator's off-server list (docs/restore.md). Not granted to any runtime role; the operator runs it as the
-- database superuser. An account that no longer exists is only recorded.
CREATE FUNCTION app_reapply_deletion(p_account uuid, p_remove_shared_foods boolean, p_deleted_at timestamptz)
	RETURNS boolean
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
	AS $$
DECLARE
	v_existed boolean;
BEGIN
	v_existed := EXISTS (SELECT 1 FROM users WHERE id = p_account);
	DELETE FROM foods WHERE owner_id = p_account AND (visibility = 'private' OR p_remove_shared_foods);
	DELETE FROM users WHERE id = p_account;
	INSERT INTO account_deletions (account_id, deleted_at, by, removed_shared_foods)
		VALUES (p_account, p_deleted_at, 'admin', p_remove_shared_foods)
		ON CONFLICT (account_id) DO NOTHING;
	RETURN v_existed;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_reapply_deletion(uuid, boolean, timestamptz) FROM PUBLIC;
