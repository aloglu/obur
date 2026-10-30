"""obur speech service: transcribes one short clip per request with faster-whisper (docs/design.md, "Typed and voice
logging"; settings measured in docs/feasibility.md). Runs inside the Compose project on an internal network with no
internet access; only the web container reaches it.

POST /transcribe  {"audio": base64 bytes (m4a/mp4, webm, ogg, wav), "prompt": optional str}
  → 200 {"text", "language", "audioS", "queueMs", "asrMs"}
  → 400 {"error": "bad_request" | "decode_failed" | "too_long"}, 413 too large, 503 {"error": "busy"}
GET  /health      → 200 {"ok": true, "model": ...} once the model is loaded

Audio is decoded from memory and never written to disk. Nothing about requests is logged: transcripts and audio stay
out of logs. One transcription runs at a time; a short queue waits, anything beyond it is told "busy".
"""

import base64
import binascii
import io
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel, decode_audio

MODEL_DIR = os.environ.get("SPEECH_MODEL_DIR", "/models/faster-whisper-small")
THREADS = int(os.environ.get("SPEECH_THREADS", "4"))
MAX_QUEUE = int(os.environ.get("SPEECH_MAX_QUEUE", "3"))
MAX_AUDIO_S = float(os.environ.get("SPEECH_MAX_SECONDS", "30"))
MAX_AUDIO_BYTES = 4 * 1024 * 1024
# base64 grows the audio by a third; the prompt is small.
MAX_BODY = MAX_AUDIO_BYTES * 4 // 3 + 16 * 1024
MAX_PROMPT_CHARS = 600
LANGUAGES = ("tr", "en")
SAMPLE_RATE = 16000


class Busy(Exception):
    pass


class Transcriber:
    def __init__(self) -> None:
        self.model = WhisperModel(MODEL_DIR, device="cpu", compute_type="int8", cpu_threads=THREADS)
        self.lock = threading.Lock()
        self.waiting = 0
        self.count_lock = threading.Lock()

    def run(self, audio_bytes: bytes, prompt: str | None) -> dict:
        with self.count_lock:
            if self.waiting > MAX_QUEUE:
                raise Busy()
            self.waiting += 1
        queued = time.perf_counter()
        try:
            with self.lock:
                started = time.perf_counter()
                audio = decode_audio(io.BytesIO(audio_bytes), sampling_rate=SAMPLE_RATE)
                seconds = len(audio) / SAMPLE_RATE
                if seconds > MAX_AUDIO_S:
                    raise ValueError("too_long")
                if seconds < 0.3:
                    return {"text": "", "language": None, "audioS": round(seconds, 2),
                            "queueMs": round((started - queued) * 1000), "asrMs": 0}
                # Turkish or English only: unrestricted detection once read a mixed sentence as Persian.
                _, _, probs = self.model.detect_language(audio)
                language = max((p for p in probs if p[0] in LANGUAGES), key=lambda p: p[1])[0]
                segments, _ = self.model.transcribe(
                    audio,
                    language=language,
                    beam_size=5,
                    initial_prompt=prompt or None,
                    condition_on_previous_text=False,
                    temperature=0.0,
                    vad_filter=False,
                )
                text = " ".join(s.text.strip() for s in segments).strip()
                done = time.perf_counter()
                return {"text": text, "language": language, "audioS": round(seconds, 2),
                        "queueMs": round((started - queued) * 1000), "asrMs": round((done - started) * 1000)}
        finally:
            with self.count_lock:
                self.waiting -= 1


def make_handler(transcriber: Transcriber):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            if self.path != "/health":
                return self._json(404, {"error": "not_found"})
            self._json(200, {"ok": True, "model": os.path.basename(MODEL_DIR)})

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/transcribe":
                return self._json(404, {"error": "not_found"})
            try:
                length = int(self.headers.get("content-length", "0"))
            except ValueError:
                length = 0
            if length <= 0:
                return self._json(400, {"error": "bad_request"})
            if length > MAX_BODY:
                return self._json(413, {"error": "too_large"})
            try:
                body = json.loads(self.rfile.read(length))
                audio = base64.b64decode(body["audio"], validate=True)
                prompt = body.get("prompt")
                if prompt is not None and not isinstance(prompt, str):
                    raise ValueError
            except (ValueError, KeyError, TypeError, binascii.Error):
                return self._json(400, {"error": "bad_request"})
            if not audio or len(audio) > MAX_AUDIO_BYTES:
                return self._json(413, {"error": "too_large"})
            try:
                result = transcriber.run(audio, (prompt or "")[:MAX_PROMPT_CHARS] or None)
            except Busy:
                return self._json(503, {"error": "busy"})
            except ValueError as exc:
                return self._json(400, {"error": "too_long" if str(exc) == "too_long" else "decode_failed"})
            except Exception:  # noqa: BLE001 - undecodable audio surfaces as various library errors
                return self._json(400, {"error": "decode_failed"})
            self._json(200, result)

        def _json(self, status: int, data: dict) -> None:
            out = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)

        def log_message(self, *_: object) -> None:
            pass  # no request logging

    return Handler


def main() -> None:
    started = time.perf_counter()
    transcriber = Transcriber()
    print(f"speech: model loaded in {time.perf_counter() - started:.1f}s, {THREADS} threads", flush=True)
    server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("SPEECH_PORT", "8000"))), make_handler(transcriber))
    server.daemon_threads = True
    server.serve_forever()


if __name__ == "__main__":
    main()
