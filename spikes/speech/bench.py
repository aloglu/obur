"""Phase 0 probe: time faster-whisper on a folder of clips and write one JSON line per clip.

Usage (inside the container):
  bench.py --model large-v3-turbo --compute int8 --threads 4 --language auto|tr \
           --beam 5 [--prompt-file prompt.txt] [--concurrency 1] --clips /audio --out /out/run.jsonl
"""

import argparse
import json
import os
import platform
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import psutil
from faster_whisper import WhisperModel, decode_audio


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--compute", default="int8")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--language", default="auto")
    ap.add_argument("--beam", type=int, default=5)
    ap.add_argument("--prompt-file")
    ap.add_argument("--concurrency", type=int, default=1)
    ap.add_argument("--clips", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--chunk-length", type=int, default=None, help="encoder window in seconds (Whisper default 30)")
    ap.add_argument("--label", default="")
    args = ap.parse_args()

    prompt = Path(args.prompt_file).read_text().strip() if args.prompt_file else None
    proc = psutil.Process()
    peak = {"rss": proc.memory_info().rss}
    stop = threading.Event()

    def sample_memory() -> None:
        while not stop.is_set():
            peak["rss"] = max(peak["rss"], proc.memory_info().rss)
            time.sleep(0.05)

    threading.Thread(target=sample_memory, daemon=True).start()

    t0 = time.perf_counter()
    model = WhisperModel(args.model, device="cpu", compute_type=args.compute,
                         cpu_threads=args.threads, num_workers=args.concurrency)
    load_s = time.perf_counter() - t0
    rss_after_load = proc.memory_info().rss

    clips = sorted(Path(args.clips).glob("v*.m4a"))

    def run(path: Path) -> dict:
        start = time.perf_counter()
        audio = decode_audio(str(path))
        decoded = time.perf_counter()
        segments, info = model.transcribe(
            audio, language=None if args.language == "auto" else args.language,
            beam_size=args.beam, initial_prompt=prompt, condition_on_previous_text=False,
            chunk_length=args.chunk_length)
        text = " ".join(s.text.strip() for s in segments)
        end = time.perf_counter()
        return {"clip": path.stem, "text": text, "audio_s": round(len(audio) / 16000, 3),
                "decode_s": round(decoded - start, 3), "total_s": round(end - start, 3),
                "language": info.language, "language_p": round(info.language_probability, 3)}

    # One untimed warm-up so the first clip does not carry one-off initialisation.
    run(clips[0])
    wall0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(run, clips))
    wall = time.perf_counter() - wall0
    stop.set()

    meta = {"label": args.label, "model": args.model, "compute": args.compute, "threads": args.threads,
            "language": args.language, "beam": args.beam, "prompt": bool(prompt),
            "concurrency": args.concurrency, "chunk_length": args.chunk_length, "load_s": round(load_s, 2),
            "rss_after_load_mb": round(rss_after_load / 2**20), "peak_rss_mb": round(peak["rss"] / 2**20),
            "wall_s": round(wall, 2), "cpu": platform.processor() or platform.machine(),
            "host_cpus": psutil.cpu_count(), "versions": Path(os.environ.get("BENCH_VERSIONS", "/versions.txt")).read_text().split(),
            "python": platform.python_version()}
    with open(args.out, "w") as f:
        f.write(json.dumps({"meta": meta}, ensure_ascii=False) + "\n")
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(json.dumps({k: meta[k] for k in ["label", "load_s", "peak_rss_mb", "wall_s"]}))


if __name__ == "__main__":
    main()
