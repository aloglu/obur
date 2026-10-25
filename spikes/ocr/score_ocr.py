"""Phase 0 probe: score OCR runs against hand-read label values.

Usage: python3 -I score_ocr.py <ground_truth.tsv> <run.jsonl> [...] [--detail <dir>]

Two measures:
- readable: the correct number appears somewhere in the OCR output (OCR quality alone).
- extracted: a deliberately naive row reader (keyword, then the numbers after it on the same line,
  skipping %RI values) puts the correct number in the correct field and basis. This is a rough
  stand-in for the real label parser, not a prediction of its accuracy.
"""

import csv
import json
import re
import statistics
import sys
from pathlib import Path

FIELDS = ["fat", "saturated_fat", "carbohydrate", "sugars", "fibre", "protein", "salt"]
KEYWORDS = [
    ("saturated_fat", r"doymu[sş]|saturated"),
    ("carbohydrate", r"karbonhidrat|carbohydrate"),
    ("sugars", r"[sş]eker|sugar"),
    ("fibre", r"\blif\b|fib(?:er|re)"),
    ("protein", r"protein"),
    ("salt", r"\btuz\b|\bsalt\b"),
    ("fat", r"\bya[gğ]\b|\bfat\b"),
    (None, r"kalsiyum|calcium|potasyum|potassium|vitamin|referans|reference|de[gğ]erler"),
]
TOKEN = re.compile("|".join(f"(?P<k{i}>{p})" for i, (_, p) in enumerate(KEYWORDS))
                   + r"|(?P<num>(?P<pct>%\s*)?\d+(?:[.,]\d+)?)", re.I)
ENERGY = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:kj)?\s*/\s*(\d+(?:[.,]\d+)?)\s*(?:kcal)?", re.I)


def num(text: str) -> float:
    return round(float(text.replace(",", ".")), 4)


def lower_tr(text: str) -> str:
    return text.replace("I", "ı").replace("İ", "i").lower()


def rows_of(lines: list[dict]) -> list[str]:
    """Group OCR boxes into visual rows by vertical centre, then order each row left to right."""
    items = []
    for line in lines:
        ys = [p[1] for p in line["box"]]
        xs = [p[0] for p in line["box"]]
        items.append({"cy": sum(ys) / 4, "h": max(ys) - min(ys), "x": min(xs), "text": line["text"]})
    items.sort(key=lambda i: i["cy"])
    rows: list[list[dict]] = []
    for item in items:
        if rows:
            row = rows[-1]
            cy = statistics.mean(i["cy"] for i in row)
            h = statistics.median(i["h"] for i in row)
            if abs(item["cy"] - cy) < 0.5 * max(h, item["h"]):
                row.append(item)
                continue
        rows.append([item])
    return [" ".join(i["text"] for i in sorted(r, key=lambda i: i["x"])) for r in rows]


def extract(lines: list[dict]) -> dict:
    found: dict[str, list[float]] = {f: [] for f in FIELDS}
    energy: list[tuple[float, float]] = []
    carry = None
    for text in rows_of(lines):
        low = lower_tr(text)
        for a, b in ENERGY.findall(low):
            if (num(a), num(b)) != (8400, 2000):
                energy.append((num(a), num(b)))
        energy_spans = [m.span() for m in ENERGY.finditer(low)]
        current, got_number, last_kw_end = carry, False, -100
        for m in TOKEN.finditer(low):
            if m.group("num"):
                if m.group("pct") or any(s <= m.start() < e for s, e in energy_spans):
                    continue
                if current:
                    found[current].append(num(m.group("num").lstrip("%").strip()))
                    got_number = True
                continue
            idx = next(i for i in range(len(KEYWORDS)) if m.group(f"k{i}"))
            field = KEYWORDS[idx][0]
            if field == "fat" and current == "saturated_fat" and m.start() - last_kw_end < 6:
                continue  # the "yağ" in "doymuş yağ"
            current, got_number, last_kw_end = field, False, m.end()
        carry = current if current and not got_number else None
    return {"energy": energy, **found}


def main() -> None:
    args = sys.argv[1:]
    detail = None
    if "--detail" in args:
        k = args.index("--detail")
        detail = Path(args[k + 1])
        del args[k:k + 2]
    truth: dict[str, list[dict]] = {}
    with open(args[0], encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter="\t"):
            truth.setdefault(r["label"], []).append(r)
    print("| run | values | readable (all / non-zero) | extracted right | extracted wrong (serious) | missing "
          "| labels fully right | p50 s | max s | peak MB |")
    print("|" + " --- |" * 10)
    for run_path in args[1:]:
        lines = [json.loads(l) for l in open(run_path, encoding="utf-8")]
        meta, images = lines[0]["meta"], {r["image"]: r for r in lines[1:]}
        readable = readable_nz = total_nz = right = wrong = missing = total = 0
        labels_right = 0
        report = []
        for label, bases in truth.items():
            ocr = images[label]["lines"]
            seen = set()
            for line in ocr:
                for m in re.finditer(r"(%\s*)?(\d+(?:[.,]\d+)?)", line["text"]):
                    if not m.group(1):
                        seen.add(num(m.group(2)))
            got = extract(ocr)
            label_ok = True
            for i, basis in enumerate(bases):
                expected = {"energy_kj": basis["energy_kj"], "energy_kcal": basis["energy_kcal"],
                            **{f: basis[f] for f in FIELDS}}
                for field, value in expected.items():
                    if value == "":
                        continue
                    value = num(value)
                    total += 1
                    readable += value in seen
                    if value != 0:
                        total_nz += 1
                        readable_nz += value in seen
                    if field.startswith("energy"):
                        pair = got["energy"][i] if i < len(got["energy"]) else None
                        actual = None if pair is None else pair[0 if field == "energy_kj" else 1]
                    else:
                        actual = got[field][i] if i < len(got[field]) else None
                    if actual is None:
                        missing += 1
                        label_ok = False
                    elif actual == value:
                        right += 1
                    else:
                        wrong += 1
                        label_ok = False
                    report.append(f"{label}\t{basis['basis']}\t{field}\t{value}\t{actual}")
            labels_right += label_ok
        times = sorted(images[l]["total_s"] for l in truth)
        print(f"| {meta['label']} | {total} | {100 * readable / total:.0f}% / {100 * readable_nz / total_nz:.0f}% "
              f"| {100 * right / total:.0f}% | {100 * wrong / total:.0f}% | {100 * missing / total:.0f}% "
              f"| {labels_right}/{len(truth)} | {times[len(times) // 2]:.2f} | {times[-1]:.2f} | {meta['peak_rss_mb']} |")
        if detail:
            detail.mkdir(parents=True, exist_ok=True)
            (detail / f"{meta['label']}.tsv").write_text("label\tbasis\tfield\texpected\tgot\n" + "\n".join(report) + "\n")


if __name__ == "__main__":
    main()
