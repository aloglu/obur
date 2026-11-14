-- Housekeeping for records that only ever grow (run nightly by the worker with the trash purge). System maintenance
-- with no personal identity: it removes only rows that can no longer be used.
--   sessions        past their absolute expiry, or unused for longer than the idle limit (14 days)
--   reminder_sends  older than 30 days (only today's matter: one reminder of a kind per day)
--   recovery_links, bootstrap_tokens  expired or used more than 30 days ago
-- Purge markers stay: they answer a very late offline retry of a purged entry.
CREATE FUNCTION app_housekeeping() RETURNS TABLE (kind text, removed bigint)
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
	AS $$
#variable_conflict use_column
BEGIN
	RETURN QUERY
	WITH
		s AS (DELETE FROM sessions WHERE expires_at < now() OR last_seen_at < now() - interval '14 days' RETURNING 1),
		r AS (DELETE FROM reminder_sends WHERE sent_at < now() - interval '30 days' RETURNING 1),
		l AS (DELETE FROM recovery_links
			WHERE coalesce(used_at, expires_at) < now() - interval '30 days' RETURNING 1),
		b AS (DELETE FROM bootstrap_tokens
			WHERE coalesce(used_at, expires_at) < now() - interval '30 days' RETURNING 1)
	SELECT 'sessions'::text, (SELECT count(*) FROM s)
	UNION ALL SELECT 'reminder_sends', (SELECT count(*) FROM r)
	UNION ALL SELECT 'recovery_links', (SELECT count(*) FROM l)
	UNION ALL SELECT 'bootstrap_tokens', (SELECT count(*) FROM b);
END
$$;
REVOKE ALL ON FUNCTION app_housekeeping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_housekeeping() TO obur_worker;
