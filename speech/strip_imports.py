"""Build step (Dockerfile): faster-whisper 1.1.1 imports PyAV, huggingface_hub and requests when it loads, although
obur's service never uses them (it passes ready 16 kHz samples and a model folder). This removes exactly those imports
and fails the build if the pinned files are not as expected, so a faster-whisper update is checked here first
(2026-11-22 audits A11, G02, G03). The code that needed them (decode_audio for files, download_model) then fails if
called, which the service never does."""

import importlib.util
import pathlib
import sys

EXPECTED = "1.1.1"
# Found without importing it: importing faster_whisper is what needs PyAV.
ROOT = pathlib.Path(importlib.util.find_spec("faster_whisper").origin).parent
EDITS = {
    "__init__.py": [
        ("from faster_whisper.audio import decode_audio\n", ""),
        ('    "decode_audio",\n', ""),
    ],
    "audio.py": [("import av\n", "")],
    "utils.py": [("import huggingface_hub\n", ""), ("import requests\n", "")],
}


def main() -> None:
    found = (ROOT / "version.py").read_text()
    if f'__version__ = "{EXPECTED}"' not in found:
        sys.exit(f"strip_imports: not faster-whisper {EXPECTED}: {found.strip()}")
    for name, edits in EDITS.items():
        path = ROOT / name
        text = path.read_text()
        for old, new in edits:
            if text.count(old) != 1:
                sys.exit(f"strip_imports: {name} no longer has exactly one {old.strip()!r}")
            text = text.replace(old, new)
        path.write_text(text)
    for path in ROOT.glob("*.py"):
        for module in ("av", "huggingface_hub", "requests"):
            for line in path.read_text().splitlines():
                stripped = line.strip()
                if stripped in (f"import {module}",) or stripped.startswith(f"from {module} "):
                    sys.exit(f"strip_imports: {path.name} still imports {module}")
    print("strip_imports: faster-whisper loads without PyAV, huggingface_hub and requests")


if __name__ == "__main__":
    main()
