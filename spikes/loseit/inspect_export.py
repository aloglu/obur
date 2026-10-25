"""Phase 0 probe: describe a LoseIt export's structure without printing diary content.

Usage: python3 -I inspect_export.py <extracted-export-dir>

For every CSV it prints row counts and, per column: fill rate, empty/zero counts,
numeric range, value shapes (digits -> 9, letters -> a) and, only for low-cardinality
non-free-text columns in files with enough rows, the distinct values themselves.
"""

import csv
import re
import sys
from collections import Counter
from pathlib import Path

FREE_TEXT = re.compile(r"name|desc|note|title|text|brand|response|label|url|email|photo|file", re.I)
MIN_ROWS_FOR_VALUES = 20
MAX_DISTINCT_FOR_VALUES = 25


def shape(value: str) -> str:
    s = re.sub(r"[0-9]", "9", value)
    s = re.sub(r"[^\W\d_]", "a", s)
    s = re.sub(r"a{2,}", "a+", s)
    s = re.sub(r"9{2,}", "9+", s)
    return s[:40]


def as_number(value: str):
    try:
        return float(value)
    except ValueError:
        return None


def describe(path: Path, root: Path) -> None:
    raw = path.read_bytes()
    encoding = "utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") else "utf-8"
    text = raw.decode(encoding, errors="replace")
    rows = list(csv.reader(text.splitlines()))
    rel = path.relative_to(root)
    if not rows:
        print(f"\n## {rel}: empty file")
        return
    header, body = rows[0], rows[1:]
    widths = Counter(len(r) for r in body)
    print(f"\n## {rel}: {len(body)} rows, {len(header)} columns, encoding={encoding}, row widths={dict(widths)}")
    for i, col in enumerate(header):
        values = [r[i].strip() if i < len(r) else "" for r in body]
        filled = [v for v in values if v != ""]
        nums = [n for n in (as_number(v) for v in filled) if n is not None]
        line = f"- `{col}`: filled {len(filled)}/{len(values)}"
        if nums:
            zeros = sum(1 for n in nums if n == 0)
            negs = sum(1 for n in nums if n < 0)
            line += f", numeric {len(nums)} (min {min(nums):g}, max {max(nums):g}, zero {zeros}, negative {negs})"
        distinct = Counter(filled)
        line += f", distinct {len(distinct)}"
        show_values = (
            len(body) >= MIN_ROWS_FOR_VALUES
            and 0 < len(distinct) <= MAX_DISTINCT_FOR_VALUES
            and not FREE_TEXT.search(col)
            and len(nums) < len(filled)
        )
        if show_values:
            line += "\n    values: " + ", ".join(f"{v!r}×{c}" for v, c in distinct.most_common())
        else:
            shapes = Counter(shape(v) for v in filled).most_common(5)
            line += "\n    shapes: " + ", ".join(f"{s!r}×{c}" for s, c in shapes)
        print(line)


def main() -> None:
    root = Path(sys.argv[1])
    for path in sorted(root.rglob("*.csv")):
        describe(path, root)


if __name__ == "__main__":
    main()
