"""Phase 0 probe: run PP-OCR models (ONNX Runtime via RapidOCR) on label images and time them.

Usage: bench_ocr.py --config A|B|C --max-side 2000 --threads 4 --images <dir> --out <run.jsonl>
  A: PP-OCRv5 mobile detector + PP-OCRv5 Latin mobile recogniser
  B: PP-OCRv6 small detector + recogniser
  C: PP-OCRv6 tiny detector + recogniser
"""

import argparse
import json
import os
import platform
import threading
import time
from pathlib import Path

import numpy as np
import psutil
from PIL import Image
from rapidocr import RapidOCR
from rapidocr.utils.typings import LangDet, LangRec, OCRVersion

MODELS = Path(os.environ.get("PADDLE_MODELS", "/models/paddle"))


def v6(size: str, box_thresh: float) -> dict:
    # Official PaddlePaddle ONNX exports from Hugging Face; preprocessing taken from each model's inference.yml.
    det, rec = MODELS / f"PP-OCRv6_{size}_det_onnx", MODELS / f"PP-OCRv6_{size}_rec_onnx"
    return {"Det.model_path": str(det / "inference.onnx"), "Det.mean": [0.485, 0.456, 0.406],
            "Det.std": [0.229, 0.224, 0.225], "Det.thresh": 0.2, "Det.box_thresh": box_thresh, "Det.unclip_ratio": 1.4,
            "Det.ocr_version": OCRVersion.PPOCRV6, "Det.lang_type": LangDet.MULTI,
            "Rec.model_path": str(rec / "inference.onnx"), "Rec.rec_keys_path": str(rec / "dict.txt"),
            "Rec.ocr_version": OCRVersion.PPOCRV6}


def v5_latin() -> dict:
    # PP-OCRv5 mobile detector + Latin recogniser, converted locally from PaddlePaddle's Hugging Face releases.
    det, rec = MODELS / "PP-OCRv5_mobile_det_onnx", MODELS / "latin_PP-OCRv5_mobile_rec_onnx"
    return {"Det.model_path": str(det / "inference.onnx"), "Det.mean": [0.485, 0.456, 0.406],
            "Det.std": [0.229, 0.224, 0.225], "Det.thresh": 0.3, "Det.box_thresh": 0.6, "Det.unclip_ratio": 1.5,
            "Det.ocr_version": OCRVersion.PPOCRV5,
            "Det.lang_type": LangDet.CH, "Rec.model_path": str(rec / "inference.onnx"),
            "Rec.rec_keys_path": str(rec / "dict.txt"), "Rec.ocr_version": OCRVersion.PPOCRV5,
            "Rec.lang_type": LangRec.LATIN}


CONFIGS = {"A": v5_latin, "B": lambda: v6("small", 0.45), "C": lambda: v6("tiny", 0.4)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, choices=CONFIGS)
    ap.add_argument("--max-side", type=int, default=2000)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--images", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--label", default="")
    args = ap.parse_args()

    proc = psutil.Process()
    peak = {"rss": proc.memory_info().rss}
    stop = threading.Event()

    def sample_memory() -> None:
        while not stop.is_set():
            peak["rss"] = max(peak["rss"], proc.memory_info().rss)
            time.sleep(0.05)

    threading.Thread(target=sample_memory, daemon=True).start()
    # The orientation classifier is off: labels are photographed upright and its model is not available offline.
    params = {**CONFIGS[args.config](), "Global.max_side_len": args.max_side, "Global.log_level": "warning",
              "Global.use_cls": False,
              "EngineConfig.onnxruntime.intra_op_num_threads": args.threads,
              "EngineConfig.onnxruntime.inter_op_num_threads": 1}
    t0 = time.perf_counter()
    engine = RapidOCR(params=params)
    load_s = time.perf_counter() - t0

    images = sorted(Path(args.images).glob("L*.jpg"))

    def load(path: Path) -> np.ndarray:
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((args.max_side, args.max_side))
            return np.asarray(im)[:, :, ::-1].copy()  # RGB -> BGR as RapidOCR expects for arrays

    engine(load(images[0]))  # untimed warm-up
    rows = []
    for path in images:
        start = time.perf_counter()
        img = load(path)
        result = engine(img)
        total = time.perf_counter() - start
        boxes = [] if result.boxes is None else result.boxes.tolist()
        rows.append({"image": path.stem, "total_s": round(total, 3), "height": img.shape[0], "width": img.shape[1],
                     "lines": [{"box": b, "text": t, "score": round(float(s), 3)}
                               for b, t, s in zip(boxes, result.txts or [], result.scores or [])]})
    stop.set()
    versions_path = Path(os.environ.get("BENCH_VERSIONS", "/versions.txt"))
    meta = {"label": args.label, "config": args.config, "max_side": args.max_side, "threads": args.threads,
            "load_s": round(load_s, 2), "peak_rss_mb": round(peak["rss"] / 2**20), "python": platform.python_version(),
            "versions": versions_path.read_text().split() if versions_path.exists() else []}
    with open(args.out, "w") as f:
        f.write(json.dumps({"meta": meta}, ensure_ascii=False) + "\n")
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(json.dumps({k: meta[k] for k in ["label", "load_s", "peak_rss_mb"]}
                     | {"p50_s": sorted(r["total_s"] for r in rows)[len(rows) // 2]}))


if __name__ == "__main__":
    main()
