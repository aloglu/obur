-- Label scan edit counts are private to the person who saved the scanned food. They are written once with the food
-- and never changed; the food and account deletions remove them by cascade.
ALTER TABLE label_scan_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_scan_edits FORCE ROW LEVEL SECURITY;
CREATE POLICY label_scan_edits_owner ON label_scan_edits TO obur_migrator USING (true) WITH CHECK (true);
CREATE POLICY label_scan_edits_own ON label_scan_edits FOR ALL TO obur_app
	USING (owner_id = app_current_user_id())
	WITH CHECK (owner_id = app_current_user_id()
		AND EXISTS (SELECT 1 FROM foods f
			WHERE f.id = food_id AND f.owner_id = app_current_user_id() AND f.origin = 'label_scan'));
GRANT SELECT, INSERT ON label_scan_edits TO obur_app;
--> statement-breakpoint

-- Household totals for admins: counts summed over everyone, never a person's rows.
CREATE FUNCTION app_label_scan_totals()
	RETURNS TABLE (
		scans bigint, without_edits bigint, proposed bigint, changed bigint, removed bigint, added bigint,
		basis_unknown bigint, basis_changed bigint
	)
	LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
	AS $$
BEGIN
	IF NOT app_current_user_is_admin() THEN
		RAISE EXCEPTION 'admins only' USING ERRCODE = '42501';
	END IF;
	RETURN QUERY SELECT
		count(*),
		count(*) FILTER (WHERE e.changed = 0 AND e.removed = 0 AND e.added = 0 AND NOT e.basis_changed),
		coalesce(sum(e.proposed), 0)::bigint,
		coalesce(sum(e.changed), 0)::bigint,
		coalesce(sum(e.removed), 0)::bigint,
		coalesce(sum(e.added), 0)::bigint,
		count(*) FILTER (WHERE NOT e.basis_known),
		count(*) FILTER (WHERE e.basis_changed)
	FROM label_scan_edits e;
END $$;
REVOKE ALL ON FUNCTION app_label_scan_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_label_scan_totals() TO obur_app;
