# Redacted LoseIt export fixture

Invented values only, in the exact layout of the owner's LoseIt export (docs/loseit-export.md). No row comes from real
data. Each row exists to exercise one edge case: a deleted row, a legitimate identical pair, the same food twice in a
meal, a calories-only database food (unknown, not zero), a thousands comma in Calories, quotes and commas in names,
two custom foods with the same name, deleted and noisy weights and water, exercise rows that are deleted (4) or a
HealthKit workout, a day marked not complete, and a budget change. The day totals in `daily-calorie-summary.csv`
equal the active rows, as in the real export.
