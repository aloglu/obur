"""obur OCR service: reads the text of one label photo per request with PaddleOCR PP-OCRv6 small through ONNX
Runtime (RapidOCR), at the settings measured in Phase 0 (docs/feasibility.md). Runs inside the Compose project on an
internal network with no internet access; only the web container reaches it. The label parser runs in the app.

POST /ocr     {"image": base64 bytes (JPEG, PNG or WebP)}
  → 200 {"lines": [{"box": [[x, y] × 4], "text", "score"}], "width", "height", "sharpness", "queueMs", "ocrMs"}
  → 400 {"error": "bad_request" | "decode_failed"}, 413 too large, 503 {"error": "busy", "ahead": n}
GET  /health  → 200 {"ok": true, "model": ...} once the models are loaded

The image is decoded from memory and never written to disk. Nothing about requests is logged. One image is read at a
time; a short queue waits, anything beyond it is told "busy".
"""

import base64
import binascii
import io
import json
import os
import signal
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import onnxruntime
from PIL import Image, ImageOps
from rapidocr import RapidOCR
from rapidocr.utils.typings import LangDet, OCRVersion

MODEL_DIR = os.environ.get("OCR_MODEL_DIR", "/models/pp-ocrv6-small")
THREADS = int(os.environ.get("OCR_THREADS", "4"))
MAX_QUEUE = int(os.environ.get("OCR_MAX_QUEUE", "3"))
MAX_SIDE = 1280
MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_BODY = MAX_IMAGE_BYTES * 4 // 3 + 1024
# A phone photo is about 12 megapixels; anything far larger is refused before decoding.
Image.MAX_IMAGE_PIXELS = 50_000_000

# ONNX Runtime ships a telemetry component; it stays off (no outbound network is reachable either way).
onnxruntime.disable_telemetry_events()


def sharpness(gray: np.ndarray) -> float | None:
    """How crisp the strongest edges are: the Laplacian against the gradient at the top 1 % of edges. Contrast does not
    change it; blur lowers it. Measured on the owner's labels (docs/feasibility.md): sharp photos 0.26 and up, copies
    blurred until the OCR stops reading them 0.14 and below. None for a photo with no edges at all."""
    g = gray.astype(np.float32)
    lap = g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:] - 4 * g[1:-1, 1:-1]
    gx = g[1:-1, 2:] - g[1:-1, :-2]
    gy = g[2:, 1:-1] - g[:-2, 1:-1]
    mag = np.sqrt(gx * gx + gy * gy)
    strong = mag > np.percentile(mag, 99)
    if not strong.any():
        return None
    return round(float(np.abs(lap)[strong].mean() / mag[strong].mean()), 3)


class Busy(Exception):
    def __init__(self, ahead: int) -> None:
        super().__init__("busy")
        self.ahead = ahead


class Reader:
    def __init__(self) -> None:
        det, rec = f"{MODEL_DIR}/det", f"{MODEL_DIR}/rec"
        # Phase 0 configuration B: preprocessing from each model's inference.yml, orientation classifier off.
        self.engine = RapidOCR(params={
            "Det.model_path": f"{det}/inference.onnx", "Det.mean": [0.485, 0.456, 0.406],
            "Det.std": [0.229, 0.224, 0.225], "Det.thresh": 0.2, "Det.box_thresh": 0.45, "Det.unclip_ratio": 1.4,
            "Det.ocr_version": OCRVersion.PPOCRV6, "Det.lang_type": LangDet.MULTI,
            "Rec.model_path": f"{rec}/inference.onnx", "Rec.rec_keys_path": f"{rec}/dict.txt",
            "Rec.ocr_version": OCRVersion.PPOCRV6,
            "Global.max_side_len": MAX_SIDE, "Global.log_level": "warning", "Global.use_cls": False,
            "EngineConfig.onnxruntime.intra_op_num_threads": THREADS,
            "EngineConfig.onnxruntime.inter_op_num_threads": 1,
        })
        self.lock = threading.Lock()
        self.waiting = 0
        self.count_lock = threading.Lock()

    def run(self, data: bytes) -> dict:
        with self.count_lock:
            if self.waiting > MAX_QUEUE:
                raise Busy(self.waiting)
            self.waiting += 1
        queued = time.perf_counter()
        try:
            with self.lock:
                started = time.perf_counter()
                with Image.open(io.BytesIO(data)) as im:
                    if im.format not in ("JPEG", "PNG", "WEBP"):
                        raise ValueError("decode_failed")
                    # One full-size copy at most (2026-11-25 Review.md audit, 3.4: three, ~450 MB for a 50 MP photo in a
                    # 1 GiB container): a JPEG decodes at the smallest scale still twice MAX_SIDE (as thumbnail() would on
                    # its own; readings unchanged on the private label sets), it turns in place, and
                    # it becomes RGB only once small.
                    im.draft("RGB", (MAX_SIDE * 2, MAX_SIDE * 2))
                    ImageOps.exif_transpose(im, in_place=True)
                    im.thumbnail((MAX_SIDE, MAX_SIDE))
                    if im.mode != "RGB":
                        im = im.convert("RGB")
                    sharp = sharpness(np.asarray(im.convert("L")))
                    pixels = np.asarray(im)[:, :, ::-1].copy()  # RGB -> BGR, as RapidOCR expects
                result = self.engine(pixels)
                boxes = [] if result.boxes is None else result.boxes.tolist()
                lines = [{"box": [[round(x, 1), round(y, 1)] for x, y in b], "text": t, "score": round(float(s), 3)}
                         for b, t, s in zip(boxes, result.txts or [], result.scores or [])]
                done = time.perf_counter()
                return {"lines": lines, "width": pixels.shape[1], "height": pixels.shape[0], "sharpness": sharp,
                        "queueMs": round((started - queued) * 1000), "ocrMs": round((done - started) * 1000)}
        finally:
            with self.count_lock:
                self.waiting -= 1


class InFlight:
    """The requests being answered, so a stop waits for them to finish, answer included (Gemini audit 2, H08)."""

    def __init__(self) -> None:
        self.count = 0
        self.changed = threading.Condition()

    def __enter__(self) -> None:
        with self.changed:
            self.count += 1

    def __exit__(self, *_: object) -> None:
        with self.changed:
            self.count -= 1
            self.changed.notify_all()

    def wait(self, timeout: float) -> None:
        with self.changed:
            self.changed.wait_for(lambda: self.count == 0, timeout)


IN_FLIGHT = InFlight()


def make_handler(reader: Reader):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            if self.path != "/health":
                return self._json(404, {"error": "not_found"})
            self._json(200, {"ok": True, "model": "PP-OCRv6 small"})

        def do_POST(self) -> None:  # noqa: N802
            with IN_FLIGHT:
                self._post()

        def _post(self) -> None:
            if self.path != "/ocr":
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
                image = base64.b64decode(json.loads(self.rfile.read(length))["image"], validate=True)
            except (ValueError, KeyError, TypeError, binascii.Error):
                return self._json(400, {"error": "bad_request"})
            if not image:  # empty: a bad request, not a large one (2026-11-23 Gemini audit 2, H20)
                return self._json(400, {"error": "bad_request"})
            if len(image) > MAX_IMAGE_BYTES:
                return self._json(413, {"error": "too_large"})
            try:
                result = reader.run(image)
            except Busy as busy:
                return self._json(503, {"error": "busy", "ahead": busy.ahead})
            except Exception:  # noqa: BLE001 - an unreadable image surfaces as various library errors
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
    reader = Reader()
    print(f"ocr: models loaded in {time.perf_counter() - started:.1f}s, {THREADS} threads", flush=True)
    server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("OCR_PORT", "8000"))), make_handler(reader))
    server.daemon_threads = True
    # As PID 1 the process gets no default SIGTERM handling: `docker stop` waited its whole grace period, then killed
    # it (2026-11-22 Gemini audit, G32). Nothing is kept, so it stops at once, but not while a request is answered:
    # tearing the native libraries down under the model could crash, and the answer would be lost (2026-11-23 Gemini
    # audit 2, H08). serve_forever() returns after shutdown(), which must run on another thread.
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=server.shutdown, daemon=True).start())
    server.serve_forever()
    server.server_close()
    # Waits for the requests already in (the model takes one at a time; at most a few wait), answers included.
    IN_FLIGHT.wait(timeout=60)


if __name__ == "__main__":
    main()
