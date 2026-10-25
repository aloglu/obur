"""Phase 0 probe speech service: localhost-only HTTP wrapper around faster-whisper.

Usage: transcribe_service.py --port 8041 --threads 4 --prompt-file prompt.txt --models large-v3-turbo,small
Audio is decoded from memory and never written to disk. Models stay loaded, as the real service would keep them.
"""

import argparse
import io
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from faster_whisper import WhisperModel, decode_audio

MAX_BYTES = 4 * 1024 * 1024
MAX_AUDIO_S = 30


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8041)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--prompt-file")
    ap.add_argument("--models", default="large-v3-turbo")
    args = ap.parse_args()
    prompt = Path(args.prompt_file).read_text().strip() if args.prompt_file else None
    models = {}
    for name in args.models.split(","):
        t0 = time.perf_counter()
        models[name] = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=args.threads)
        print(f"loaded {name} in {time.perf_counter() - t0:.1f}s", flush=True)
    lock = threading.Lock()  # one transcription at a time, like a concurrency-1 queue

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            length = int(self.headers.get("content-length", 0))
            if self.path != "/transcribe" or not 0 < length <= MAX_BYTES:
                self.send_error(400)
                return
            body = self.rfile.read(length)
            name = self.headers.get("x-model", "large-v3-turbo")
            model = models.get(name) or next(iter(models.values()))
            waited = time.perf_counter()
            with lock:
                start = time.perf_counter()
                try:
                    audio = decode_audio(io.BytesIO(body))
                except Exception as exc:  # noqa: BLE001 - report decode failures to the probe page
                    self._json({"error": f"decode failed: {type(exc).__name__}"})
                    return
                if len(audio) / 16000 > MAX_AUDIO_S:
                    self._json({"error": "clip too long"})
                    return
                decoded = time.perf_counter()
                segments, info = model.transcribe(audio, language=None, beam_size=5, initial_prompt=prompt,
                                                  condition_on_previous_text=False)
                text = " ".join(s.text.strip() for s in segments)
                done = time.perf_counter()
            self._json({"text": text, "language": info.language, "audioS": round(len(audio) / 16000, 2),
                        "queueMs": round((start - waited) * 1000), "decodeMs": round((decoded - start) * 1000),
                        "asrMs": round((done - decoded) * 1000), "servedModel": name if name in models else "default"})

        def _json(self, data: dict) -> None:
            out = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)

        def log_message(self, *_: object) -> None:
            pass  # no request logging: transcripts and audio metadata stay out of logs

    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
