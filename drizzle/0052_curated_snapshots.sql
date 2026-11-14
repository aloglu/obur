-- Copies of built-in USDA foods in the diary, saved meals and recipes say so (`curated`), so their fixed names show
-- in the interface language (docs/design.md, "Built-in USDA foods"). Display only: names, amounts and nutrients are
-- untouched, and so are revisions. Typed foods, LoseIt foods and copies whose food is gone are left as they are.
UPDATE diary_entries e SET food = e.food || '{"curated": true}'::jsonb
FROM foods f
WHERE e.food_id = f.id AND f.origin = 'curated' AND e.food IS NOT NULL AND NOT (e.food ? 'curated');
--> statement-breakpoint
UPDATE saved_meal_items i SET food = i.food || '{"curated": true}'::jsonb
FROM foods f
WHERE i.food_id = f.id AND f.origin = 'curated' AND i.food IS NOT NULL AND NOT (i.food ? 'curated');
--> statement-breakpoint
UPDATE recipe_ingredients r SET food = r.food || '{"curated": true}'::jsonb
FROM foods f
WHERE r.food_id = f.id AND f.origin = 'curated' AND NOT (r.food ? 'curated');
