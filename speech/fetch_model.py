"""Downloads the pinned faster-whisper model at image build time and checks every file's SHA-256. Run once in the
Dockerfile; the running service never downloads anything."""

import hashlib
import sys
import urllib.request
from pathlib import Path

REPO = "Systran/faster-whisper-small"
REVISION = "536b0662742c02347bc0e980a01041f333bce120"
FILES = {
    "config.json": "b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828",
    "model.bin": "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671",
    "tokenizer.json": "fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab",
    "vocabulary.txt": "34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913",
}


def main(target: str) -> None:
    out = Path(target)
    out.mkdir(parents=True, exist_ok=True)
    for name, expected in FILES.items():
        url = f"https://huggingface.co/{REPO}/resolve/{REVISION}/{name}"
        digest = hashlib.sha256()
        with urllib.request.urlopen(url, timeout=120) as response, open(out / name, "wb") as f:
            while chunk := response.read(1 << 20):
                digest.update(chunk)
                f.write(chunk)
        if digest.hexdigest() != expected:
            sys.exit(f"{name}: checksum mismatch ({digest.hexdigest()})")
        print(f"{name}: ok")


if __name__ == "__main__":
    main(sys.argv[1])
