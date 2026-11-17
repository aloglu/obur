-- Foods (archived ones only) and saved meals can be deleted to Recently deleted, restored for 30 days, and are then
-- purged for good (docs/design.md, "Archived and deleted foods"). Their owners set and clear the deletion date.
GRANT UPDATE (deleted_at) ON foods TO obur_app;
--> statement-breakpoint
GRANT UPDATE (deleted_at) ON saved_meals TO obur_app;
--> statement-breakpoint

-- The nightly purge now also removes foods and saved meals deleted more than 30 days ago. A purged food takes its
-- nutrients, servings, recipe and scan counts with it (cascade); diary entries, saved meal items and recipe
-- ingredients keep their own snapshots and lose only the link (set null), as variants lose their source.
CREATE OR REPLACE FUNCTION app_purge_trash(p_cutoff timestamptz) RETURNS TABLE (kind text, purged bigint)
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
		f AS (DELETE FROM foods e WHERE e.deleted_at < p_cutoff AND e.owner_id IS NOT NULL
			RETURNING e.id, e.owner_id AS user_id, 'food'::text AS k),
		s AS (DELETE FROM saved_meals e WHERE e.deleted_at < p_cutoff RETURNING e.id, e.user_id, 'saved_meal'::text AS k),
		gone AS (
			SELECT * FROM d UNION ALL SELECT * FROM w UNION ALL SELECT * FROM a UNION ALL SELECT * FROM c
			UNION ALL SELECT * FROM f UNION ALL SELECT * FROM s
		),
		marked AS (
			INSERT INTO purged_records (id, user_id, kind) SELECT g.id, g.user_id, g.k FROM gone g
			ON CONFLICT (id) DO NOTHING RETURNING purged_records.kind
		)
	SELECT m.kind, count(*) FROM marked m GROUP BY m.kind;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_purge_trash(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_purge_trash(timestamptz) TO obur_worker;
