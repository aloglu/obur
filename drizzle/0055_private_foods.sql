-- Foods become private (owner, 2026-11-17; docs/design.md, "Foods are private"). Every member who logged, saved or
-- used someone else's food gets their own copy, and their records point at it; foods whose maker deleted their
-- account are removed once copied. Built-in (curated) foods stay readable by everyone and editable by no one.
-- The next migration drops the visibility column and the deletion list's shared-foods flag.

-- Who uses which food that isn't theirs: diary entries (trash included), saved meal items, recipe ingredients and
-- import identities (an archive import could link a shared food rather than copy it).
CREATE TEMP TABLE food_copies (
	source uuid NOT NULL,
	user_id uuid NOT NULL,
	copy uuid NOT NULL DEFAULT gen_random_uuid(),
	PRIMARY KEY (source, user_id)
) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO food_copies (source, user_id)
SELECT DISTINCT f.id, r.user_id
FROM foods f
JOIN (
	SELECT food_id, user_id FROM diary_entries WHERE food_id IS NOT NULL
	UNION SELECT food_id, user_id FROM saved_meal_items WHERE food_id IS NOT NULL
	UNION SELECT food_id, owner_id FROM recipe_ingredients WHERE food_id IS NOT NULL
	UNION SELECT local_id, user_id FROM import_identities WHERE kind = 'food'
) r ON r.food_id = f.id
WHERE f.origin <> 'curated' AND f.owner_id IS DISTINCT FROM r.user_id;
--> statement-breakpoint

-- The copies: a plain food with the same values and portions. A recipe becomes a plain food with its totals, as
-- others saw it; provenance notes stay with the original.
INSERT INTO foods (id, owner_id, visibility, name, brand, search_key, basis, serving_label, serving_amount,
	serving_unit, barcode, icon, origin, archived_at, created_at, updated_at)
SELECT c.copy, c.user_id, 'private', f.name, f.brand, f.search_key, f.basis, f.serving_label, f.serving_amount,
	f.serving_unit, f.barcode, f.icon, 'variant', f.archived_at, now(), now()
FROM food_copies c JOIN foods f ON f.id = c.source;
--> statement-breakpoint
INSERT INTO food_nutrients (food_id, code, value, qualifier)
SELECT c.copy, n.code, n.value, n.qualifier
FROM food_copies c JOIN food_nutrients n ON n.food_id = c.source;
--> statement-breakpoint

-- New portion IDs: a unit naming a portion finds it again by name, as after any edit (shared/diary-rules.ts).
INSERT INTO food_servings (food_id, name, amount, unit, source)
SELECT c.copy, s.name, s.amount, s.unit, s.source
FROM food_copies c JOIN food_servings s ON s.food_id = c.source;
--> statement-breakpoint

-- Point each member's records at their copy.
UPDATE diary_entries d SET food_id = c.copy
FROM food_copies c WHERE d.food_id = c.source AND d.user_id = c.user_id;
--> statement-breakpoint
UPDATE saved_meal_items i SET food_id = c.copy
FROM food_copies c WHERE i.food_id = c.source AND i.user_id = c.user_id;
--> statement-breakpoint
UPDATE recipe_ingredients i SET food_id = c.copy
FROM food_copies c WHERE i.food_id = c.source AND i.owner_id = c.user_id;
--> statement-breakpoint
UPDATE import_identities i SET local_id = c.copy
FROM food_copies c WHERE i.kind = 'food' AND i.local_id = c.source AND i.user_id = c.user_id;
--> statement-breakpoint

-- A variant of someone else's food no longer points at it.
UPDATE foods f SET derived_from = NULL
FROM foods src
WHERE f.derived_from = src.id AND src.origin <> 'curated' AND src.owner_id IS DISTINCT FROM f.owner_id;
--> statement-breakpoint

-- Foods left without an owner (their maker deleted their account) were copied to everyone using them.
DELETE FROM foods WHERE owner_id IS NULL AND origin <> 'curated';
--> statement-breakpoint

-- Access: your own foods, and the built-in ones. Only the owner changes a food; built-in foods change only by migration.
DROP POLICY foods_select ON foods;
--> statement-breakpoint
DROP POLICY foods_update ON foods;
--> statement-breakpoint
CREATE POLICY foods_select ON foods FOR SELECT TO obur_app, obur_worker
	USING (owner_id = app_current_user_id() OR origin = 'curated');
--> statement-breakpoint
CREATE POLICY foods_update ON foods FOR UPDATE TO obur_app
	USING (owner_id = app_current_user_id())
	WITH CHECK (owner_id = app_current_user_id());
--> statement-breakpoint
DROP POLICY food_nutrients_write ON food_nutrients;
--> statement-breakpoint
CREATE POLICY food_nutrients_write ON food_nutrients FOR ALL TO obur_app
	USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.owner_id = app_current_user_id()))
	WITH CHECK (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.owner_id = app_current_user_id()));
--> statement-breakpoint
DROP POLICY food_servings_write ON food_servings;
--> statement-breakpoint
CREATE POLICY food_servings_write ON food_servings FOR ALL TO obur_app
	USING (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.owner_id = app_current_user_id()))
	WITH CHECK (EXISTS (SELECT 1 FROM foods f WHERE f.id = food_id AND f.owner_id = app_current_user_id()));
--> statement-breakpoint

-- Deleting an account removes all of its foods (the owner column cascades from the next migration on).
DROP FUNCTION app_delete_account(uuid, boolean);
--> statement-breakpoint
CREATE FUNCTION app_delete_account(p_account uuid) RETURNS void
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
	DELETE FROM foods WHERE owner_id = p_account;
	DELETE FROM users WHERE id = p_account;
	INSERT INTO account_deletions (account_id, by) VALUES (p_account, v_by);
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_delete_account(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_delete_account(uuid) TO obur_app;
--> statement-breakpoint

-- After a restore: deletes again an account deleted after the backup was taken (docs/restore.md). Operator only.
DROP FUNCTION app_reapply_deletion(uuid, boolean, timestamptz);
--> statement-breakpoint
CREATE FUNCTION app_reapply_deletion(p_account uuid, p_deleted_at timestamptz)
	RETURNS boolean
	LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
	AS $$
DECLARE
	v_existed boolean;
BEGIN
	v_existed := EXISTS (SELECT 1 FROM users WHERE id = p_account);
	DELETE FROM foods WHERE owner_id = p_account;
	DELETE FROM users WHERE id = p_account;
	INSERT INTO account_deletions (account_id, deleted_at, by)
		VALUES (p_account, p_deleted_at, 'admin')
		ON CONFLICT (account_id) DO NOTHING;
	RETURN v_existed;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_reapply_deletion(uuid, timestamptz) FROM PUBLIC;
