"""obur speech service: transcribes one short clip per request with faster-whisper (docs/design.md, "Typed and voice
logging"; settings measured in docs/feasibility.md). Runs inside the Compose project on an internal network with no
internet access; only the web container reaches it.

POST /transcribe  {"audio": base64 16 kHz mono 16-bit PCM WAV, "prompt": optional str}
  → 200 {"text", "language", "audioS", "queueMs", "asrMs"}
  → 400 {"error": "bad_request" | "decode_failed" | "too_long"}, 413 too large, 503 {"error": "busy"}
GET  /health      → 200 {"ok": true, "model": ...} once the model is loaded

Speak makes the WAV on the phone (src/lib/client/wav.ts), so no media decoder (FFmpeg) is in this image (2026-11-22 audits
A11, G02, G03). Audio is read from memory and never written to disk. Nothing about requests is logged: transcripts and audio stay
out of logs. One transcription runs at a time; a short queue waits, anything beyond it is told "busy".
"""

import base64
import binascii
import io
import json
import os
import signal
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
from faster_whisper import WhisperModel
from faster_whisper.audio import pad_or_trim
from faster_whisper.tokenizer import Tokenizer

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


def read_wav(data: bytes, max_seconds: float) -> np.ndarray:
    """The samples of a 16 kHz mono 16-bit PCM WAV as float32. Anything else is "decode_failed"; a clip longer than
    max_seconds is "too_long", judged from its header before its samples are read."""
    try:
        with wave.open(io.BytesIO(data), "rb") as clip:
            if (clip.getnchannels(), clip.getsampwidth(), clip.getframerate()) != (1, 2, SAMPLE_RATE):
                raise ValueError("decode_failed")
            if clip.getnframes() > max_seconds * SAMPLE_RATE:
                raise ValueError("too_long")
            frames = clip.readframes(clip.getnframes())
    except (wave.Error, EOFError) as exc:
        raise ValueError("decode_failed") from exc
    return np.frombuffer(frames[: len(frames) // 2 * 2], dtype="<i2").astype(np.float32) / 32768.0


OPTIONS_ONLY = np.zeros(16000, dtype=np.float32)


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
                audio = read_wav(audio_bytes, MAX_AUDIO_S)
                seconds = len(audio) / SAMPLE_RATE
                if seconds > MAX_AUDIO_S:
                    raise ValueError("too_long")
                if seconds < 0.3:
                    return {"text": "", "language": None, "audioS": round(seconds, 2),
                            "queueMs": round((started - queued) * 1000), "asrMs": 0}
                language, segments = self.transcribe(audio, prompt)
                text = " ".join(s.text.strip() for s in segments).strip()
                done = time.perf_counter()
                return {"text": text, "language": language, "audioS": round(seconds, 2),
                        "queueMs": round((started - queued) * 1000), "asrMs": round((done - started) * 1000)}
        finally:
            with self.count_lock:
                self.waiting -= 1

    def transcribe(self, audio: np.ndarray, prompt: str | None):
        """Detects Turkish or English and transcribes, with one pass of the encoder (the model's first stage, about
        a third of the time) for both (2026-11-21 audit, C10). faster-whisper has no public way to share that pass, so
        this uses its internals, checked against the pinned 1.1.1: the first window exactly as `generate_segments`
        cuts it, encoded once, then given to it. The text is the same as `transcribe(language=...)` gives."""
        m = self.model
        features = m.feature_extractor(audio)
        first = pad_or_trim(features[:, : min(m.feature_extractor.nb_max_frames, features.shape[-1] - 1)])
        encoded = m.encode(first)
        # Turkish or English only: unrestricted detection once read a mixed sentence as Persian.
        probs = {token[2:-2]: p for token, p in m.model.detect_language(encoded)[0]}
        language = max(LANGUAGES, key=lambda code: probs.get(code, 0.0))
        # transcribe() builds the options with every default; its segments are lazy and never run. It is given one
        # second of silence: its options do not depend on the audio, and the whole clip's features were already made
        # above (2026-11-23 Gemini audit 2, H21: they were made twice).
        _, info = m.transcribe(
            OPTIONS_ONLY,
            language=language,
            beam_size=5,
            initial_prompt=prompt or None,
            condition_on_previous_text=False,
            temperature=0.0,
            vad_filter=False,
        )
        tokenizer = Tokenizer(m.hf_tokenizer, m.model.is_multilingual, task="transcribe", language=language)
        return language, m.generate_segments(features, tokenizer, info.transcription_options, False, encoded)


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
            if not audio:  # empty: a bad request, not a large one (2026-11-23 Gemini audit 2, H20)
                return self._json(400, {"error": "bad_request"})
            if len(audio) > MAX_AUDIO_BYTES:
                return self._json(413, {"error": "too_large"})
            try:
                result = transcriber.run(audio, (prompt or "")[:MAX_PROMPT_CHARS] or None)
            except Busy:
                return self._json(503, {"error": "busy"})
            except ValueError as exc:
                return self._json(400, {"error": "too_long" if str(exc) == "too_long" else "decode_failed"})
            except Exception:  # noqa: BLE001 - the model itself failed: an answer, not a dropped connection
                return self._json(500, {"error": "failed"})
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
    # As PID 1 the process gets no default SIGTERM handling: `docker stop` waited its whole grace period, then killed
    # it (2026-11-22 Gemini audit, G32). Nothing is kept, so it stops at once, but not while the model is working:
    # tearing the native libraries down under it could crash (2026-11-23 Gemini audit 2, H08). serve_forever() returns
    # after shutdown(), which must run on another thread.
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=server.shutdown, daemon=True).start())
    server.serve_forever()
    server.server_close()
    # Waits for the request the model is on (at most one at a time); the ones still queued are dropped.
    transcriber.lock.acquire(timeout=60)


if __name__ == "__main__":
    main()
