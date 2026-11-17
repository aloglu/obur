-- "Make my own variant" is offered only on built-in foods (2026-11-17). Before that, tapping it on one's own food
-- made a copy that points at it, and its page would now call it a variant of a built-in food. Only a copy of a
-- built-in food keeps its source.
UPDATE foods f SET derived_from = NULL
FROM foods src
WHERE f.derived_from = src.id AND src.origin <> 'curated';
