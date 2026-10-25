"""Phase 0 probe: aggregate checks on a LoseIt export. Prints counts and differences only.

Usage: python3 -I analyze_export.py <extracted-export-dir>
"""

import csv
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def load(root: Path, name: str):
    with open(root / name, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    return rows[0], rows[1:]


def dicts(root: Path, name: str):
    header, body = load(root, name)
    return [dict(zip(header, r)) for r in body]


def num(v: str):
    try:
        return float(v)
    except ValueError:
        return None


def dates_report(label: str, values) -> None:
    parts = [tuple(int(p) for p in v.split("/")) for v in values]
    print(f"- {label}: first part max {max(p[0] for p in parts)}, second part max {max(p[1] for p in parts)}, "
          f"third part range {min(p[2] for p in parts)}-{max(p[2] for p in parts)}")


def parse_date(v: str) -> datetime:
    return datetime.strptime(v, "%m/%d/%Y")


def main() -> None:
    root = Path(sys.argv[1])
    logs = dicts(root, "food-logs.csv")
    foods = dicts(root, "custom-foods.csv")
    servings = dicts(root, "active-food-servings.csv")
    summary = dicts(root, "daily-calorie-summary.csv")

    print("## Dates")
    for name in ["food-logs.csv", "weights.csv", "water-intake.csv", "daily-calorie-summary.csv", "exercise-logs.csv"]:
        dates_report(name, [r["Date"] for r in dicts(root, name)])
    log_dates = sorted({parse_date(r["Date"]) for r in logs})
    span = (log_dates[-1] - log_dates[0]).days + 1
    print(f"- food-log span {span} days, {len(log_dates)} days with entries, {span - len(log_dates)} days without")
    offsets = Counter(re.sub(r".*T[0-9:.]+", "", r["Last Updated"]) for r in dicts(root, "weights.csv"))
    print(f"- weights Last Updated suffixes: {dict(offsets)}")
    offsets = Counter(re.sub(r".*T[0-9:.]+", "", r["Created"]) for r in servings)
    print(f"- servings Created suffixes: {dict(offsets)}")

    print("\n## Food logs")
    print(f"- columns: {list(logs[0].keys())}")
    print(f"- Deleted values: {dict(Counter(r['Deleted'] for r in logs))}")
    odd = [r["Calories"] for r in logs if num(r["Calories"]) is None]
    print(f"- non-numeric Calories values: {odd}")
    nonascii = sum(1 for r in logs if any(ord(c) > 127 for c in r["Name"]))
    turkish = sum(1 for r in logs if re.search(r"[çğıöşüÇĞİÖŞÜ]", r["Name"]))
    print(f"- names with non-ASCII: {nonascii}, with Turkish letters: {turkish}, with U+FFFD: "
          f"{sum(1 for r in logs if chr(0xFFFD) in r['Name'])}")
    active = [r for r in logs if r["Deleted"] == "0"]
    key = lambda r: tuple(r[k] for k in r if k != "Icon")
    dup = Counter(key(r) for r in active)
    print(f"- active rows {len(active)}; fully identical active rows: {sum(c - 1 for c in dup.values() if c > 1)} "
          f"extra copies across {sum(1 for c in dup.values() if c > 1)} groups (max group {max(dup.values())})")
    per_meal_day = Counter((r["Date"], r["Meal"], r["Name"]) for r in active)
    print(f"- same food twice in one day+meal: {sum(1 for c in per_meal_day.values() if c > 1)} cases")
    na = Counter()
    for r in active:
        for k in ["Calories", "Fat (g)", "Protein (g)", "Carbohydrates (g)", "Saturated Fat (g)", "Sugars (g)",
                  "Fiber (g)", "Cholesterol (mg)", "Sodium (mg)"]:
            na[k, "n/a" if r[k] == "n/a" else ("empty" if r[k] == "" else ("zero" if num(r[k]) == 0 else "value"))] += 1
    print("- active nutrient states (value/zero/n/a):")
    for k in sorted({k for k, _ in na}):
        print(f"    {k}: value {na[k, 'value']}, zero {na[k, 'zero']}, n/a {na[k, 'n/a']}, empty {na[k, 'empty']}")
    cal_zero_but_macros = sum(1 for r in active if num(r["Calories"]) == 0
                              and any((num(r[k]) or 0) > 0 for k in ["Fat (g)", "Protein (g)", "Carbohydrates (g)"]))
    print(f"- active rows with 0 kcal but positive macros: {cal_zero_but_macros}")
    calories_only = sum(1 for r in active if num(r["Calories"]) and all(r[k] in ("n/a", "0", "")
                        for k in ["Fat (g)", "Protein (g)", "Carbohydrates (g)"]))
    print(f"- active rows with kcal but no macros (calories-only candidates): {calories_only}")

    print("\n## Linking logs to foods")
    food_names = Counter(f["Name"] for f in foods)
    log_names = Counter(r["Name"] for r in active)
    matched = [n for n in log_names if n in food_names]
    print(f"- distinct active log names {len(log_names)}; exact name match to a custom food: {len(matched)} "
          f"({sum(log_names[n] for n in matched)} rows); custom-food names duplicated: "
          f"{sum(1 for c in food_names.values() if c > 1)}")
    food_ids = {f["UniqueId"] for f in foods}
    serving_ids = {s["FoodUniqueId"] for s in servings}
    print(f"- serving FoodUniqueIds {len(serving_ids)}, of which custom foods {len(serving_ids & food_ids)}; "
          f"custom foods without a serving row {len(food_ids - serving_ids)}")
    # Are log nutrients totals for the logged amount? Compare against custom food scaled by quantity.
    unit_map = {"Grams": "Grams", "Milliliters": "Milliliters"}
    by_name = {f["Name"]: f for f in foods if food_names[f["Name"]] == 1}
    ratios = []
    for r in active:
        f = by_name.get(r["Name"])
        if not f or unit_map.get(r["Units"]) != f["Measure"]:
            continue
        fc, rc, fq, rq = num(f["Calories"]), num(r["Calories"]), num(f["Quantity"]), num(r["Quantity"])
        if fc and rc and fq and rq:
            ratios.append(rc / (fc * rq / fq))
    if ratios:
        close = sum(1 for x in ratios if abs(x - 1) < 0.02)
        print(f"- logged kcal vs custom food scaled by grams/ml: {len(ratios)} comparable rows, "
              f"{close} within 2%, {len(ratios) - close} differ (food edited later, or a different source)")

    print("\n## Daily totals vs log rows")
    sums = defaultdict(float)
    for r in active:
        sums[r["Date"]] += num(r["Calories"].replace(",", "")) or 0
    diffs = []
    for s in summary:
        diffs.append(abs(num(s["Food cals"]) - sums.get(s["Date"], 0)))
    exact = sum(1 for d in diffs if d < 1)
    print(f"- summary days {len(summary)}; |Food cals - sum(active log kcal)| < 1 kcal: {exact}; "
          f"1-10: {sum(1 for d in diffs if 1 <= d < 10)}; >=10: {sum(1 for d in diffs if d >= 10)}; max {max(diffs):.0f}")
    del_sums = defaultdict(float)
    for r in logs:
        del_sums[r["Date"]] += num(r["Calories"].replace(",", "")) or 0
    print(f"- same check including deleted rows: <1 kcal on "
          f"{sum(1 for s in summary if abs(num(s['Food cals']) - del_sums.get(s['Date'], 0)) < 1)} days")
    for nutrient, field in [("carbohydrates.csv", "Carbohydrates (g)"), ("fat.csv", "Fat (g)"), ("protein.csv", "Protein (g)")]:
        daily = {r["Date"]: num(r["Value"]) for r in dicts(root, nutrient)}
        s2 = defaultdict(float)
        for r in active:
            s2[r["Date"]] += num(r[field]) or 0
        d = [abs(v - s2.get(k, 0)) for k, v in daily.items()]
        print(f"- {nutrient}: {len(d)} days, within 0.5 g of log sum: {sum(1 for x in d if x < 0.5)}, max diff {max(d):.1f} g")

    print("\n## Budget fields")
    rel = Counter()
    bonus = {r["Date"]: r for r in dicts(root, "calorie-bonus.csv")}
    for s in summary:
        budget, eer, ex = num(s["Budget cals"]), num(s["EER"]), num(s["Exercise cals"])
        rel[round(eer - budget + ex)] += 1
    print(f"- EER - Budget + Exercise cals (rounded), top values: {rel.most_common(5)}")
    rel2 = Counter(round(eer - bud) for eer, bud in ((num(s["EER"]), num(s["Budget cals"])) for s in summary))
    print(f"- EER - Budget (rounded), top values: {rel2.most_common(5)}")
    matches = Counter()
    for s in summary:
        b = bonus.get(s["Date"])
        if b:
            matches["bonus day"] += 1
            matches["Value≈Exercise cals"] += abs(num(b["Value"]) - num(s["Exercise cals"])) < 1
    print(f"- calorie-bonus days matched to summary: {dict(matches)}")

    print("\n## Exercise")
    ex = dicts(root, "exercise-logs.csv")
    print(f"- names (constant labels): {dict(Counter(r['Name'] for r in ex))}")
    print(f"- Deleted values: {dict(Counter(r['Deleted'] for r in ex))}")
    ex_by_day = defaultdict(float)
    for r in ex:
        if r["Deleted"] == "0":
            ex_by_day[r["Date"]] += -(num(r["Calories"]) or 0)
    agree = sum(1 for s in summary if abs(ex_by_day.get(s["Date"], 0) - num(s["Exercise cals"])) < 1)
    print(f"- summary Exercise cals equals -sum(active exercise Calories) on {agree}/{len(summary)} days")

    print("\n## Weights and water")
    w = [num(r["Weight"]) for r in dicts(root, "weights.csv") if r["Deleted"] == "false"]
    print(f"- weights: {len(w)} active; <120: {sum(1 for x in w if x < 120)}, >=120: {sum(1 for x in w if x >= 120)}")
    ordered = [num(r["Weight"]) for r in sorted(dicts(root, "weights.csv"), key=lambda r: parse_date(r["Date"]))
               if r["Deleted"] == "false"]
    jumps = sum(1 for a, b in zip(ordered, ordered[1:]) if abs(a - b) > 15)
    print(f"- consecutive weigh-ins differing by >15: {jumps}")
    water = [num(r["Value"]) for r in dicts(root, "water-intake.csv")]
    print(f"- water: multiples of 250 {sum(1 for x in water if x % 250 == 0)}/{len(water)}; "
          f"distinct remainders mod 250: {sorted({round(x % 250, 2) for x in water})[:8]}")
    print(f"- profile field names: {[r['Name'] for r in dicts(root, 'profile.csv')]}")
    print(f"- daily-values Name constant: {set(r['Name'] for r in dicts(root, 'daily-values.csv'))}")

    print("\n## Recipes")
    header, body = load(root, "recipes.csv")
    print(f"- header {len(header)} columns, row widths {dict(Counter(len(r) for r in body))}")
    print(f"- header: {header}")
    print(f"- Measure values: {dict(Counter(r[3] for r in body))}")


if __name__ == "__main__":
    main()
