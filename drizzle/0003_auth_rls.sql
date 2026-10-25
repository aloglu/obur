-- Authentication access rules (docs/design.md, "Security and authentication" and "Database isolation").
-- Signed-in people reach only their own credentials, sessions and recovery codes through RLS. Steps that happen
-- before an identity exists (first admin, invite redemption, sign-in lookup, recovery) go through the narrow
-- SECURITY DEFINER functions below, owned by the schema owner, which RLS policies explicitly allow.

-- The schema owner runs these functions and the operator commands; FORCE ROW LEVEL SECURITY applies to it too,
-- so each auth table grants it an explicit policy.
CREATE POLICY users_owner ON users TO obur_migrator USING (true) WITH CHECK (true);
--> statement-breakpoint

-- SECURITY DEFINER so that the users policy below can call it without recursing into itself.
CREATE FUNCTION app_current_user_is_admin() RETURNS boolean
	LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$ SELECT EXISTS (
		SELECT 1 FROM users WHERE id = app_current_user_id() AND role = 'admin' AND disabled_at IS NULL
	) $$;
REVOKE ALL ON FUNCTION app_current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_user_is_admin() TO obur_app, obur_worker;
--> statement-breakpoint

-- Admins see every member (to invite, disable and recover them); members still see only themselves.
CREATE POLICY users_select_admin ON users FOR SELECT TO obur_app USING (app_current_user_is_admin());
--> statement-breakpoint

-- Credentials: own rows only. Adding one while signed in requires a recent passkey check (enforced in the app).
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY credentials_owner ON credentials TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY credentials_select_own ON credentials FOR SELECT TO obur_app USING (user_id = app_current_user_id());
CREATE POLICY credentials_insert_own ON credentials FOR INSERT TO obur_app WITH CHECK (user_id = app_current_user_id());
CREATE POLICY credentials_update_own ON credentials FOR UPDATE TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
CREATE POLICY credentials_delete_own ON credentials FOR DELETE TO obur_app USING (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON credentials TO obur_app;
GRANT UPDATE (label, counter, last_used_at) ON credentials TO obur_app;
--> statement-breakpoint

-- Sessions: own rows only; the app may create only normal sessions. Lookup by token uses auth_session_lookup().
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_owner ON sessions TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY sessions_select_own ON sessions FOR SELECT TO obur_app USING (user_id = app_current_user_id());
CREATE POLICY sessions_insert_own ON sessions FOR INSERT TO obur_app
	WITH CHECK (user_id = app_current_user_id() AND kind = 'normal');
CREATE POLICY sessions_update_own ON sessions FOR UPDATE TO obur_app
	USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
CREATE POLICY sessions_delete_own ON sessions FOR DELETE TO obur_app USING (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON sessions TO obur_app;
GRANT UPDATE (last_seen_at, verified_at) ON sessions TO obur_app;
--> statement-breakpoint

-- Invites: visible to and managed by active admins only.
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY;
CREATE POLICY invites_owner ON invites TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY invites_select_admin ON invites FOR SELECT TO obur_app USING (app_current_user_is_admin());
CREATE POLICY invites_insert_admin ON invites FOR INSERT TO obur_app
	WITH CHECK (app_current_user_is_admin() AND created_by = app_current_user_id()
		AND used_at IS NULL AND used_by IS NULL AND revoked_at IS NULL);
CREATE POLICY invites_update_admin ON invites FOR UPDATE TO obur_app
	USING (app_current_user_is_admin()) WITH CHECK (app_current_user_is_admin());
GRANT SELECT, INSERT ON invites TO obur_app;
GRANT UPDATE (revoked_at) ON invites TO obur_app;
--> statement-breakpoint

-- Recovery codes: own rows only (count, regenerate, discard). Redemption goes through auth_begin_recovery_code().
ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY recovery_codes_owner ON recovery_codes TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY recovery_codes_select_own ON recovery_codes FOR SELECT TO obur_app USING (user_id = app_current_user_id());
CREATE POLICY recovery_codes_insert_own ON recovery_codes FOR INSERT TO obur_app
	WITH CHECK (user_id = app_current_user_id() AND used_at IS NULL);
CREATE POLICY recovery_codes_delete_own ON recovery_codes FOR DELETE TO obur_app USING (user_id = app_current_user_id());
GRANT SELECT, INSERT, DELETE ON recovery_codes TO obur_app;
--> statement-breakpoint

-- Recovery links and bootstrap tokens: no direct application access at all.
ALTER TABLE recovery_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_links FORCE ROW LEVEL SECURITY;
CREATE POLICY recovery_links_owner ON recovery_links TO obur_migrator USING (true) WITH CHECK (true);
ALTER TABLE bootstrap_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE bootstrap_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY bootstrap_tokens_owner ON bootstrap_tokens TO obur_migrator USING (true) WITH CHECK (true);
--> statement-breakpoint

-- True when a bootstrap token is valid and no account exists yet.
CREATE FUNCTION auth_bootstrap_available(p_token_hash text) RETURNS boolean
	LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$ SELECT NOT EXISTS (SELECT 1 FROM users)
		AND EXISTS (SELECT 1 FROM bootstrap_tokens
			WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()) $$;
--> statement-breakpoint

-- Creates the first admin and their credential, consuming the bootstrap token. Fails if any account exists.
CREATE FUNCTION auth_bootstrap_admin(
	p_token_hash text, p_user_id uuid, p_display_name text,
	p_credential_id text, p_public_key text, p_counter bigint, p_transports text[],
	p_device_type text, p_backed_up boolean, p_label text
) RETURNS void
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$
DECLARE
	v_token_id uuid;
BEGIN
	-- Serialise concurrent attempts so only one first admin can ever be created.
	LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE;
	SELECT id INTO v_token_id FROM bootstrap_tokens
		WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now() FOR UPDATE;
	IF v_token_id IS NULL OR EXISTS (SELECT 1 FROM users) THEN
		RAISE EXCEPTION 'bootstrap_unavailable' USING ERRCODE = 'P0001';
	END IF;
	UPDATE bootstrap_tokens SET used_at = now() WHERE id = v_token_id;
	INSERT INTO users (id, display_name, role) VALUES (p_user_id, p_display_name, 'admin');
	INSERT INTO credentials (id, user_id, public_key, counter, transports, device_type, backed_up, label)
		VALUES (p_credential_id, p_user_id, p_public_key, p_counter, p_transports, p_device_type, p_backed_up, p_label);
END $$;
--> statement-breakpoint

CREATE FUNCTION auth_invite_available(p_token_hash text) RETURNS boolean
	LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$ SELECT EXISTS (SELECT 1 FROM invites
		WHERE token_hash = p_token_hash AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()) $$;
--> statement-breakpoint

-- Creates a member and their credential from an invite, consuming it exactly once.
CREATE FUNCTION auth_redeem_invite(
	p_token_hash text, p_user_id uuid, p_display_name text,
	p_credential_id text, p_public_key text, p_counter bigint, p_transports text[],
	p_device_type text, p_backed_up boolean, p_label text
) RETURNS void
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$
DECLARE
	v_invite_id uuid;
BEGIN
	SELECT id INTO v_invite_id FROM invites
		WHERE token_hash = p_token_hash AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
		FOR UPDATE;
	IF v_invite_id IS NULL THEN
		RAISE EXCEPTION 'invite_unavailable' USING ERRCODE = 'P0001';
	END IF;
	INSERT INTO users (id, display_name, role) VALUES (p_user_id, p_display_name, 'member');
	UPDATE invites SET used_at = now(), used_by = p_user_id WHERE id = v_invite_id;
	INSERT INTO credentials (id, user_id, public_key, counter, transports, device_type, backed_up, label)
		VALUES (p_credential_id, p_user_id, p_public_key, p_counter, p_transports, p_device_type, p_backed_up, p_label);
END $$;
--> statement-breakpoint

-- Sign-in lookup by credential ID. Disabled accounts are invisible.
CREATE FUNCTION auth_find_credential(p_credential_id text)
	RETURNS TABLE (user_id uuid, public_key text, counter bigint, transports text[])
	LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$ SELECT c.user_id, c.public_key, c.counter, c.transports
		FROM credentials c JOIN users u ON u.id = c.user_id
		WHERE c.id = p_credential_id AND u.disabled_at IS NULL $$;
--> statement-breakpoint

-- Session lookup by token hash for each request. Disabled accounts and expired sessions return nothing.
CREATE FUNCTION auth_session_lookup(p_token_hash text)
	RETURNS TABLE (session_id uuid, user_id uuid, kind text, role text, display_name text,
		last_seen_at timestamptz, expires_at timestamptz, verified_at timestamptz)
	LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$ SELECT s.id, s.user_id, s.kind, u.role, u.display_name, s.last_seen_at, s.expires_at, s.verified_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = p_token_hash AND s.expires_at > now() AND u.disabled_at IS NULL $$;
--> statement-breakpoint

-- Consumes a recovery code exactly once and opens a short recovery session. Returns the user, or NULL.
CREATE FUNCTION auth_begin_recovery_code(p_code_hash text, p_session_token_hash text, p_expires_at timestamptz)
	RETURNS uuid
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$
DECLARE
	v_user_id uuid;
BEGIN
	UPDATE recovery_codes rc SET used_at = now()
		FROM users u
		WHERE rc.code_hash = p_code_hash AND rc.used_at IS NULL AND u.id = rc.user_id AND u.disabled_at IS NULL
		RETURNING rc.user_id INTO v_user_id;
	IF v_user_id IS NOT NULL THEN
		INSERT INTO sessions (user_id, token_hash, kind, expires_at) VALUES (v_user_id, p_session_token_hash, 'recovery', p_expires_at);
	END IF;
	RETURN v_user_id;
END $$;
--> statement-breakpoint

-- Consumes an operator-issued recovery link exactly once and opens a short recovery session.
CREATE FUNCTION auth_begin_recovery_link(p_token_hash text, p_session_token_hash text, p_expires_at timestamptz)
	RETURNS uuid
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$
DECLARE
	v_user_id uuid;
BEGIN
	UPDATE recovery_links rl SET used_at = now()
		FROM users u
		WHERE rl.token_hash = p_token_hash AND rl.used_at IS NULL AND rl.expires_at > now()
			AND u.id = rl.user_id AND u.disabled_at IS NULL
		RETURNING rl.user_id INTO v_user_id;
	IF v_user_id IS NOT NULL THEN
		INSERT INTO sessions (user_id, token_hash, kind, expires_at) VALUES (v_user_id, p_session_token_hash, 'recovery', p_expires_at);
	END IF;
	RETURN v_user_id;
END $$;
--> statement-breakpoint

-- Finishes recovery atomically: revokes every session, credential, recovery code and recovery link of the user,
-- enrols the replacement credential, stores fresh recovery codes and opens a normal session.
CREATE FUNCTION auth_complete_recovery(
	p_recovery_token_hash text, p_new_session_token_hash text, p_session_expires_at timestamptz,
	p_credential_id text, p_public_key text, p_counter bigint, p_transports text[],
	p_device_type text, p_backed_up boolean, p_label text, p_code_hashes text[]
) RETURNS uuid
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
	AS $$
DECLARE
	v_user_id uuid;
BEGIN
	SELECT s.user_id INTO v_user_id FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = p_recovery_token_hash AND s.kind = 'recovery' AND s.expires_at > now()
			AND u.disabled_at IS NULL
		FOR UPDATE OF s;
	IF v_user_id IS NULL THEN
		RAISE EXCEPTION 'recovery_unavailable' USING ERRCODE = 'P0001';
	END IF;
	DELETE FROM sessions WHERE user_id = v_user_id;
	DELETE FROM credentials WHERE user_id = v_user_id;
	DELETE FROM recovery_codes WHERE user_id = v_user_id;
	DELETE FROM recovery_links WHERE user_id = v_user_id;
	INSERT INTO credentials (id, user_id, public_key, counter, transports, device_type, backed_up, label)
		VALUES (p_credential_id, v_user_id, p_public_key, p_counter, p_transports, p_device_type, p_backed_up, p_label);
	INSERT INTO recovery_codes (user_id, code_hash) SELECT v_user_id, unnest(p_code_hashes);
	INSERT INTO sessions (user_id, token_hash, kind, expires_at) VALUES (v_user_id, p_new_session_token_hash, 'normal', p_session_expires_at);
	RETURN v_user_id;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION auth_bootstrap_available(text), auth_bootstrap_admin(text, uuid, text, text, text, bigint, text[], text, boolean, text),
	auth_invite_available(text), auth_redeem_invite(text, uuid, text, text, text, bigint, text[], text, boolean, text),
	auth_find_credential(text), auth_session_lookup(text),
	auth_begin_recovery_code(text, text, timestamptz), auth_begin_recovery_link(text, text, timestamptz),
	auth_complete_recovery(text, text, timestamptz, text, text, bigint, text[], text, boolean, text, text[])
	FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_bootstrap_available(text), auth_bootstrap_admin(text, uuid, text, text, text, bigint, text[], text, boolean, text),
	auth_invite_available(text), auth_redeem_invite(text, uuid, text, text, text, bigint, text[], text, boolean, text),
	auth_find_credential(text), auth_session_lookup(text),
	auth_begin_recovery_code(text, text, timestamptz), auth_begin_recovery_link(text, text, timestamptz),
	auth_complete_recovery(text, text, timestamptz, text, text, bigint, text[], text, boolean, text, text[])
	TO obur_app;
