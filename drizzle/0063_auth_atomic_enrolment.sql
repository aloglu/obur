-- 2026-11-21 audit (A05, A06, A07).
-- A06: joining (first admin or invite) saves the account, its passkey, its first session and its recovery codes in
-- one transaction, so a failure never leaves a spent link with no codes.
-- A07: starting recovery no longer uses up the code or link; the recovery session records it, and finishing
-- recovery (which replaces every code and link) uses it up. An abandoned attempt leaves it usable once the session
-- ends; a new attempt with the same proof replaces the earlier session.
-- A05: finishing recovery removes the passkeys before the sessions, so a sign-in that verified a passkey and is
-- committing its session either finishes first (and its session is then removed) or finds the passkey gone.

DROP FUNCTION auth_bootstrap_admin(text, uuid, text, text, text, bigint, text[], text, boolean, text);
--> statement-breakpoint
DROP FUNCTION auth_redeem_invite(text, uuid, text, text, text, bigint, text[], text, boolean, text);
--> statement-breakpoint

CREATE FUNCTION auth_bootstrap_admin(
	p_token_hash text, p_user_id uuid, p_display_name text,
	p_credential_id text, p_public_key text, p_counter bigint, p_transports text[],
	p_device_type text, p_backed_up boolean, p_label text,
	p_session_token_hash text, p_session_expires_at timestamptz, p_code_hashes text[]
) RETURNS void
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
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
	INSERT INTO recovery_codes (user_id, code_hash) SELECT p_user_id, unnest(p_code_hashes);
	INSERT INTO sessions (user_id, token_hash, kind, expires_at)
		VALUES (p_user_id, p_session_token_hash, 'normal', p_session_expires_at);
END $$;
--> statement-breakpoint

CREATE FUNCTION auth_redeem_invite(
	p_token_hash text, p_user_id uuid, p_display_name text,
	p_credential_id text, p_public_key text, p_counter bigint, p_transports text[],
	p_device_type text, p_backed_up boolean, p_label text,
	p_session_token_hash text, p_session_expires_at timestamptz, p_code_hashes text[]
) RETURNS void
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
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
	INSERT INTO recovery_codes (user_id, code_hash) SELECT p_user_id, unnest(p_code_hashes);
	INSERT INTO sessions (user_id, token_hash, kind, expires_at)
		VALUES (p_user_id, p_session_token_hash, 'normal', p_session_expires_at);
END $$;
--> statement-breakpoint

-- Opens a short recovery session for an unused recovery code, without using it up. Returns the user, or NULL.
CREATE OR REPLACE FUNCTION auth_begin_recovery_code(p_code_hash text, p_session_token_hash text, p_expires_at timestamptz)
	RETURNS uuid
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
	AS $$
DECLARE
	v_code_id uuid;
	v_user_id uuid;
BEGIN
	SELECT rc.id, rc.user_id INTO v_code_id, v_user_id FROM recovery_codes rc JOIN users u ON u.id = rc.user_id
		WHERE rc.code_hash = p_code_hash AND rc.used_at IS NULL AND u.disabled_at IS NULL
		FOR UPDATE OF rc;
	IF v_code_id IS NOT NULL THEN
		-- One attempt per code at a time: a new one replaces the earlier session.
		DELETE FROM sessions WHERE recovery_code_id = v_code_id;
		INSERT INTO sessions (user_id, token_hash, kind, expires_at, recovery_code_id)
			VALUES (v_user_id, p_session_token_hash, 'recovery', p_expires_at, v_code_id);
	END IF;
	RETURN v_user_id;
END $$;
--> statement-breakpoint

-- Opens a short recovery session for an operator-issued link that is still valid, without using it up.
CREATE OR REPLACE FUNCTION auth_begin_recovery_link(p_token_hash text, p_session_token_hash text, p_expires_at timestamptz)
	RETURNS uuid
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
	AS $$
DECLARE
	v_link_id uuid;
	v_user_id uuid;
BEGIN
	SELECT rl.id, rl.user_id INTO v_link_id, v_user_id FROM recovery_links rl JOIN users u ON u.id = rl.user_id
		WHERE rl.token_hash = p_token_hash AND rl.used_at IS NULL AND rl.expires_at > now()
			AND u.disabled_at IS NULL
		FOR UPDATE OF rl;
	IF v_link_id IS NOT NULL THEN
		DELETE FROM sessions WHERE recovery_link_id = v_link_id;
		INSERT INTO sessions (user_id, token_hash, kind, expires_at, recovery_link_id)
			VALUES (v_user_id, p_session_token_hash, 'recovery', p_expires_at, v_link_id);
	END IF;
	RETURN v_user_id;
END $$;
--> statement-breakpoint

-- Finishes recovery atomically: revokes every credential, session, recovery code and recovery link of the user
-- (which uses up the proof the recovery began with), enrols the replacement credential, stores fresh recovery
-- codes and opens a normal session. Credentials go first (A05, above).
CREATE OR REPLACE FUNCTION auth_complete_recovery(
	p_recovery_token_hash text, p_new_session_token_hash text, p_session_expires_at timestamptz,
	p_credential_id text, p_public_key text, p_counter bigint, p_transports text[],
	p_device_type text, p_backed_up boolean, p_label text, p_code_hashes text[]
) RETURNS uuid
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp
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
	DELETE FROM credentials WHERE user_id = v_user_id;
	DELETE FROM sessions WHERE user_id = v_user_id;
	DELETE FROM recovery_codes WHERE user_id = v_user_id;
	DELETE FROM recovery_links WHERE user_id = v_user_id;
	INSERT INTO credentials (id, user_id, public_key, counter, transports, device_type, backed_up, label)
		VALUES (p_credential_id, v_user_id, p_public_key, p_counter, p_transports, p_device_type, p_backed_up, p_label);
	INSERT INTO recovery_codes (user_id, code_hash) SELECT v_user_id, unnest(p_code_hashes);
	INSERT INTO sessions (user_id, token_hash, kind, expires_at) VALUES (v_user_id, p_new_session_token_hash, 'normal', p_session_expires_at);
	RETURN v_user_id;
END $$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION
	auth_bootstrap_admin(text, uuid, text, text, text, bigint, text[], text, boolean, text, text, timestamptz, text[]),
	auth_redeem_invite(text, uuid, text, text, text, bigint, text[], text, boolean, text, text, timestamptz, text[])
	FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
	auth_bootstrap_admin(text, uuid, text, text, text, bigint, text[], text, boolean, text, text, timestamptz, text[]),
	auth_redeem_invite(text, uuid, text, text, text, bigint, text[], text, boolean, text, text, timestamptz, text[])
	TO obur_app;
