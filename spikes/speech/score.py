"""Phase 0 probe: score benchmark runs against the reference transcripts.

Usage: python3 -I score.py <transcripts.tsv> <run.jsonl> [<run.jsonl> ...] [--errors <dir>]

Both reference and hypothesis go through the same normalisation (Turkish-aware lowercasing,
number words to digits, decimal comma/dot unified), so spelling numbers either way is not an error.
"""

import csv
import difflib
import json
import re
import statistics
import sys
from pathlib import Path

TR_UNITS = {"bir": 1, "iki": 2, "üç": 3, "dört": 4, "beş": 5, "altı": 6, "yedi": 7, "sekiz": 8, "dokuz": 9,
            "on": 10, "yirmi": 20, "otuz": 30, "kırk": 40, "elli": 50, "altmış": 60, "yetmiş": 70,
            "seksen": 80, "doksan": 90}
EN_UNITS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
            "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
            "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
            "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
UNITS = {**TR_UNITS, **EN_UNITS}
HUNDRED = {"yüz", "hundred"}
THOUSAND = {"bin", "thousand"}
HALF = "⅟2"  # internal token for "buçuk" / "and a half"
STOP = {"yedim", "içtim", "olarak", "yanında", "ve", "i", "ı", "had", "of", "for", "the", "a", "as", "with", "to",
        "ate", "drank", "after", "and", "add", "log"}
FOLD = str.maketrans("çğıöşüâî", "cgiosuai")


def lower_tr(text: str) -> str:
    return text.replace("I", "ı").replace("İ", "i").lower()


def normalise(text: str) -> list[str]:
    t = lower_tr(text)
    t = re.sub(r"(\d)[,.](\d)", r"\1.\2", t)
    t = re.sub(r"(\d)(g|gr|ml|kg)\b", r"\1 \2", t)
    t = re.sub(r"\b(g|gr|grams|gram)\b", "gram", t)
    t = re.sub(r"\b(ml|milliliters|millilitres|mililitre)\b", "ml", t)
    t = re.sub(r"%\s*(\d+)", r"yüzde \1", t)
    t = re.sub(r"[’'`]", "", t)
    t = re.sub(r"\band a half\b", HALF, t)
    t = re.sub(r"\bbuçuk\b", HALF, t)
    t = re.sub(r"[^\w.⅟ ]+|(?<!\d)\.|\.(?!\d)", " ", t)
    tokens = t.split()
    out: list[str] = []
    total = current = 0
    active = False

    def flush() -> None:
        nonlocal total, current, active
        if active:
            out.append(str(total + current))
        total = current = 0
        active = False

    for tok in tokens:
        if tok in UNITS:
            current += UNITS[tok]
            active = True
        elif tok in HUNDRED:
            current = (current or 1) * 100
            active = True
        elif tok in THOUSAND:
            total += (current or 1) * 1000
            current = 0
            active = True
        else:
            flush()
            out.append(tok)
    flush()
    # Join decimals and halves after number conversion.
    joined: list[str] = []
    i = 0
    while i < len(out):
        if i + 2 < len(out) and out[i].isdigit() and out[i + 1] in ("virgül", "nokta", "point") and out[i + 2].isdigit():
            joined.append(f"{out[i]}.{out[i + 2]}")
            i += 3
        elif i + 1 < len(out) and out[i].isdigit() and out[i + 1] == HALF:
            joined.append(f"{out[i]}.5")
            i += 2
        else:
            joined.append(out[i])
            i += 1
    return joined


def is_number(tok: str) -> bool:
    return re.fullmatch(r"\d+(\.\d+)?", tok) is not None


def wer(ref: list[str], hyp: list[str]) -> float:
    d = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        prev, d[0] = d[0], i
        for j, h in enumerate(hyp, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (r != h))
    return d[len(hyp)] / max(1, len(ref))


def fuzzy_present(word: str, hyp: list[str]) -> bool:
    folded = word.translate(FOLD)
    candidates = hyp + [a + b for a, b in zip(hyp, hyp[1:])]
    return any(difflib.SequenceMatcher(None, folded, c.translate(FOLD)).ratio() >= 0.8 for c in candidates)


def score_clip(ref_text: str, hyp_text: str) -> dict:
    ref, hyp = normalise(ref_text), normalise(hyp_text)
    ref_nums = sorted(t for t in ref if is_number(t))
    hyp_nums = sorted(t for t in hyp if is_number(t))
    content = [t for t in ref if not is_number(t) and t not in STOP]
    exact = [t in hyp for t in content]
    fuzzy = [t in hyp or fuzzy_present(t, hyp) for t in content]
    numbers_ok = ref_nums == hyp_nums
    return {"wer": wer(ref, hyp), "numbers_ok": numbers_ok,
            "content_exact": sum(exact) / max(1, len(exact)), "content_fuzzy": sum(fuzzy) / max(1, len(fuzzy)),
            "clip_exact": numbers_ok and all(exact), "clip_fuzzy": numbers_ok and all(fuzzy),
            "missed": [t for t, ok in zip(content, fuzzy) if not ok]}


def pct(values) -> str:
    values = list(values)
    return f"{100 * sum(values) / max(1, len(values)):.0f}%"


def quantile(values, q: float) -> float:
    values = sorted(values)
    return values[min(len(values) - 1, int(round(q * (len(values) - 1))))]


def main() -> None:
    args = sys.argv[1:]
    errors_dir = None
    if "--errors" in args:
        k = args.index("--errors")
        errors_dir = Path(args[k + 1])
        del args[k:k + 2]
    with open(args[0], encoding="utf-8") as f:
        refs = {r["clip"]: r for r in csv.DictReader(f, delimiter="\t")}
    print("| run | n | WER | numbers right | content exact | content fuzzy | clip fully right (exact / fuzzy) "
          "| tr / en / mix fuzzy-right | lang detect right | p50 s | p95 s | max s | load s | peak MB |")
    print("|" + " --- |" * 14)
    for run_path in args[1:]:
        lines = [json.loads(l) for l in open(run_path, encoding="utf-8")]
        meta, rows = lines[0]["meta"], lines[1:]
        scored = []
        for r in rows:
            ref = refs[r["clip"]]
            s = score_clip(ref["text"], r["text"])
            s.update(clip=r["clip"], lang=ref["lang"], conditions=ref["conditions"], ref=ref["text"], hyp=r["text"],
                     detected=r["language"], total_s=r["total_s"])
            scored.append(s)
        by_lang = {lang: [s["clip_fuzzy"] for s in scored if s["lang"] == lang] for lang in ("tr", "en", "mix")}
        detect = [s["detected"] == s["lang"] for s in scored if s["lang"] in ("tr", "en")]
        times = [s["total_s"] for s in scored]
        print(f"| {meta['label']} | {len(scored)} | {statistics.mean(s['wer'] for s in scored):.2f} "
              f"| {pct(s['numbers_ok'] for s in scored)} "
              f"| {pct(s['content_exact'] for s in scored)} | {pct(s['content_fuzzy'] for s in scored)} "
              f"| {pct(s['clip_exact'] for s in scored)} / {pct(s['clip_fuzzy'] for s in scored)} "
              f"| {pct(by_lang['tr'])} / {pct(by_lang['en'])} / {pct(by_lang['mix'])} "
              f"| {pct(detect) if meta['language'] == 'auto' or ',' in meta['language'] else 'forced'} "
              f"| {quantile(times, .5):.2f} | {quantile(times, .95):.2f} | {max(times):.2f} "
              f"| {meta['load_s']} | {meta['peak_rss_mb']} |")
        if errors_dir:
            errors_dir.mkdir(parents=True, exist_ok=True)
            with open(errors_dir / f"{meta['label']}.tsv", "w", encoding="utf-8") as f:
                f.write("clip\tlang\tconditions\tnumbers_ok\tmissed\tref\thyp\n")
                for s in scored:
                    if not s["clip_fuzzy"]:
                        f.write(f"{s['clip']}\t{s['lang']}\t{s['conditions']}\t{s['numbers_ok']}\t"
                                f"{','.join(s['missed'])}\t{s['ref']}\t{s['hyp']}\n")


if __name__ == "__main__":
    main()
