-- Purge markers are private to their owner and written only by the purge function.
ALTER TABLE purged_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE purged_records FORCE ROW LEVEL SECURITY;
CREATE POLICY purged_records_owner ON purged_records TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY purged_records_select_own ON purged_records FOR SELECT TO obur_app, obur_worker
	USING (user_id = app_current_user_id());
GRANT SELECT ON purged_records TO obur_app, obur_worker;
--> statement-breakpoint

-- Purges trash older than the cutoff for everyone (system maintenance run by the worker; no personal identity is
-- involved, and it can only remove rows that are already in the trash). Each purged row leaves a marker with its ID,
-- owner and kind, so a late retry of the same client ID cannot recreate it.
CREATE FUNCTION app_purge_trash(p_cutoff timestamptz) RETURNS TABLE (kind text, purged bigint)
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
	AS $$
#variable_conflict use_column
BEGIN
	IF p_cutoff > now() - interval '30 days' THEN
		RAISE EXCEPTION 'cutoff must be at least 30 days ago' USING ERRCODE = '22023';
	END IF;
	RETURN QUERY
	WITH
		d AS (DELETE FROM diary_entries e WHERE e.deleted_at < p_cutoff RETURNING e.id, e.user_id, 'diary'::text AS k),
		w AS (DELETE FROM weight_entries e WHERE e.deleted_at < p_cutoff RETURNING e.id, e.user_id, 'weight'::text AS k),
		a AS (DELETE FROM water_entries e WHERE e.deleted_at < p_cutoff RETURNING e.id, e.user_id, 'water'::text AS k),
		c AS (DELETE FROM activity_entries e WHERE e.deleted_at < p_cutoff RETURNING e.id, e.user_id, 'activity'::text AS k),
		gone AS (SELECT * FROM d UNION ALL SELECT * FROM w UNION ALL SELECT * FROM a UNION ALL SELECT * FROM c),
		marked AS (
			INSERT INTO purged_records (id, user_id, kind) SELECT g.id, g.user_id, g.k FROM gone g
			ON CONFLICT (id) DO NOTHING RETURNING purged_records.kind
		)
	SELECT m.kind, count(*) FROM marked m GROUP BY m.kind;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_purge_trash(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_purge_trash(timestamptz) TO obur_worker;
