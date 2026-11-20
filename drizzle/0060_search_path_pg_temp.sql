-- Privileged functions search pg_temp last, so a temporary table can never stand in for a real one (2026-11-20 audit).
-- The runtime roles cannot create temporary tables today; this keeps it safe if that ever changes.
ALTER FUNCTION app_current_user_is_admin() SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_begin_recovery_code(p_code_hash text, p_session_token_hash text, p_expires_at timestamp with time zone) SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_begin_recovery_link(p_token_hash text, p_session_token_hash text, p_expires_at timestamp with time zone) SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_bootstrap_admin(p_token_hash text, p_user_id uuid, p_display_name text, p_credential_id text, p_public_key text, p_counter bigint, p_transports text[], p_device_type text, p_backed_up boolean, p_label text) SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_bootstrap_available(p_token_hash text) SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_complete_recovery(p_recovery_token_hash text, p_new_session_token_hash text, p_session_expires_at timestamp with time zone, p_credential_id text, p_public_key text, p_counter bigint, p_transports text[], p_device_type text, p_backed_up boolean, p_label text, p_code_hashes text[]) SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_find_credential(p_credential_id text) SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_invite_available(p_token_hash text) SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_redeem_invite(p_token_hash text, p_user_id uuid, p_display_name text, p_credential_id text, p_public_key text, p_counter bigint, p_transports text[], p_device_type text, p_backed_up boolean, p_label text) SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint
ALTER FUNCTION auth_session_lookup(p_token_hash text) SET search_path = pg_catalog, public, pg_temp;
