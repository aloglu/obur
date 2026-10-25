# LoseIt export: observed format

Observed from the owner's export on 2026-10-25 using `spikes/loseit/`. Structure, counts and aggregate checks only; no diary values. This describes one export from one account at one point in time, not a guaranteed LoseIt contract. The importer must detect this layout by its headers and stop on anything else.

## Archive

A ZIP of 29 UTF-8 CSV files (no BOM) in three folders, about 420 KB uncompressed. Comma-separated and quoted where needed (food names contain commas). Turkish letters are intact; no replacement characters were found.

| File | Rows | Relevance |
| --- | --- | --- |
| `food-logs.csv` | 2,522 (102 deleted) | Diary entries: the main import |
| `custom-foods.csv` | 147 | Foods the owner created, with nutrients per stated quantity |
| `active-food-servings.csv` | 414 | Serving definitions for 356 foods (all 147 custom foods plus LoseIt database foods) |
| `recipes.csv` | 9 | Recipe headers only: **no ingredients**, and the rows are malformed (see below) |
| `weights.csv` | 151 (1 deleted) | Weigh-ins, **no unit column** |
| `water-intake.csv` | 268 | Daily water total |
| `exercise-logs.csv` | 86 | Device "Calorie Burn Bonus" rows plus one HealthKit workout |
| `calorie-bonus.csv` | 118 | Two values per day whose meaning is unresolved |
| `daily-calorie-summary.csv` | 274 | Per-day food kcal, exercise kcal, budget and EER |
| `carbohydrates.csv`, `fat.csv`, `protein.csv` | 270 each | Per-day totals |
| `daily-values.csv` | 270 | One `Complete` marker per day (day marked complete); imports as obur's day-completion marker |
| `steps.csv` | 265 | Daily steps: out of scope |
| `profile.csv` | 11 | Name/value pairs: birthday, gender, height, start/current/goal weight, calorie adjustment, current EER, plan, activity level, start date |
| `achievements.csv`, `achievement-actions.csv`, `notes.csv`, `fasting-schedules.csv`, `food-photos/food-photos.csv` | ≤55 | Small; photos are tokens only, no images. Out of scope for the first importer |
| Seven other files (courses, focuses, fasting logs, lab reports, medication, progress photos, custom exercises) | 0 | Headers only |

## Conventions

- **Diary dates are `M/D/YYYY`** (second part reaches 31). No time of day, no meal time and no time zone. The owner confirmed all entries were made in `Europe/Istanbul`; the import preview should still ask for the zone and record it with the batch.
- **`Last Updated` timestamps carry `+0300`**; `active-food-servings.csv` uses UTC `Z`. These are edit times, not eating times.
- **Decimals use a dot.** `Calories` in `food-logs.csv` can contain a **thousands comma** (`1,255`, three rows). Parse per column, never by guessing locale.
- **Unknown is `n/a`, distinct from `0`.** In active diary rows, for example, fibre is `n/a` in 770 rows and `0` in 306. Map `n/a` to unknown, never zero.
- **Deleted rows are included**: `Deleted` is `0`/`1` in food logs, `false`/`true` in weights and servings, and `0`/`4` in exercise logs. Deleted rows must not be imported as active history.
- Unit names are inconsistent (`Serving`/`Servings`, `Teaspoon`/`Teaspoons`, `Grams` in logs but `Gram` in servings) and include count units (`Each` 288 rows, `Can`, `Bottle`, `Piece`, `Slices`) and US measures (`Cup`, `Dry Cup`, `Metric Cup`, `Ounce`, `Fluid ounce`).

## Food logs

Columns: `Date, Name, Icon, Meal, Quantity, Units, Calories, Deleted, Fat (g), Protein (g), Carbohydrates (g), Saturated Fat (g), Sugars (g), Fiber (g), Cholesterol (mg), Sodium (mg)`.

- **No entry ID and no food ID.** Rows can't be linked to a food or matched across exports by identity. Overlapping imports need a fingerprint (date, meal, name, quantity, unit, nutrients) with occurrence counting.
- Legitimate repeats exist: 1 fully identical pair and 3 cases of the same food twice in one day and meal. Fingerprint deduplication would wrongly merge them unless multiplicity is counted.
- **Nutrients are totals for the logged amount**: for 1,218 of the 1,270 rows comparable with a custom food, kcal matched the food scaled by grams/ml within 2%. The other 52 likely reflect foods edited after logging. The import should snapshot the row's own values and not recompute them from foods.
- 138 of the 239 distinct active names match a custom food exactly (1,465 rows); 4 custom-food names are duplicated. The rest are LoseIt database foods, whose nutrients exist only in these rows.
- Meals: `Breakfast`, `Lunch`, `Dinner`, `Snacks`, `Morning Snacks`, `Afternoon Snacks`. Mapping to obur meals is an importer decision to confirm with the owner.
- 125 active rows have kcal but no macros: likely quick-add calories. They should import as calories-only entries.
- Sodium is reported; salt would be derived (sodium × 2.5 / 1000), with sodium retained.
- Carbohydrate definition is not stated. LoseIt mixes database and user-entered values (the user's are from Turkish/EU labels). The importer must treat it as an unknown carbohydrate definition rather than assume EU or USDA.

## Reconciliation baseline

- `daily-calorie-summary.csv` `Food cals` **equals the sum of active food-log kcal on all 274 days** (difference < 1 kcal). This is the import's acceptance check. Including deleted rows breaks it on 46 days, which confirms that deleted rows are excluded.
- The per-day macro files agree with row sums within 0.5 g on 76–96% of days, with a maximum difference of 3.4 g. That suggests rounding; the tolerance needs documenting before it's used as a gate.

## Budget and activity

- `EER − Budget cals` is 1,100 kcal on 269 of 274 days: the plan's fixed deficit (consistent with 1 kg/week at about 7,700 kcal/kg). LoseIt's `Budget cals` does **not** include exercise.
- `Exercise cals` equals the negated sum of active `exercise-logs.csv` calories on every day. Those rows are almost all `Calorie Burn Bonus`, a device-derived adjustment, stored as negative numbers.
- `calorie-bonus.csv` `Value` matches `Exercise cals` on only 30 of 118 days; `Secondary Value` reaches about 3,800 and may be total device energy. **Meaning unresolved.** Per the design, these are recorded with their source and not added to the obur budget.

## Weights and water

- **Weight has no unit column.** The owner confirmed this export is in kilograms. Other exports may not be, so the import preview must ask for the unit rather than infer it.
- Water values are daily totals from 750 to 3,750 in steps of 250 (some with float noise such as 1999.99): consistent with millilitres. To be confirmed.

## Recipes

`recipes.csv` has a 15-column header but every row has 14 fields. Under the header, `Calories` ranges from 0.13 to 85 while `Cholesterol (mg)` holds sodium-like values and `Sodium (mg)` is empty. That suggests the `Calories` field is missing from rows and the rest shifted left. This is plausible but **not verified**. No ingredients are exported. Recipe diary rows still carry their own nutrients in `food-logs.csv`, so history is not affected. Importing recipes as reusable foods needs a check against the app first.

## Gaps and open questions

- Resolved with the owner: weight is kg, the zone is Europe/Istanbul, and the history really starts in January 2026 (the export is complete in date range).
- Meaning of `calorie-bonus.csv` and of exercise `Deleted = 4`.
- Recipe column shift and the missing ingredients.
- No eaten times, so imported entries have a date and meal only.

A redacted fixture with invented values preserving these edge cases will be created with the Phase 2 importer, for owner review before commit.
