"""Downloads PaddlePaddle's official PP-OCRv6 small ONNX exports at image build time (pinned revisions) and checks
every file's SHA-256: the same files measured in Phase 0. The recogniser's character list is written from its
inference.yml and checked too. Run once in the Dockerfile; the running service never downloads anything."""

import hashlib
import sys
import urllib.request
from pathlib import Path

import yaml

MODELS = {
    "det": ("PaddlePaddle/PP-OCRv6_small_det_onnx", "28fe5895c24fd108c19eb3e8479f4ab385fbfc62", {
        "inference.onnx": "d73e0058b7a8086bbd57f3d10b8bcd4ff95363f67e06e2762b5e814fe9c9410e",
        "inference.yml": "193f435274bf9f0b5f71a929bbfbcf148282df7e633b34e7c373e8f44741b516",
    }),
    "rec": ("PaddlePaddle/PP-OCRv6_small_rec_onnx", "b8f84f0b80c529de40b4fbb3544b84fa7233a513", {
        "inference.onnx": "5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634",
        "inference.yml": "ab078671bb49f06228eadccd34f1bb501e157f7a047095ffb943ba81512c77d1",
    }),
}
DICT_SHA256 = "b5f2bfe2bdd9448429e3e82b51c789775d9b42f2403d082b00662eb77e401c5d"


def characters(node):
    """The recogniser's character_dict, wherever it sits in inference.yml."""
    if isinstance(node, dict):
        for key, value in node.items():
            found = value if key == "character_dict" else characters(value)
            if found is not None:
                return found
    if isinstance(node, list):
        for value in node:
            found = characters(value)
            if found is not None:
                return found
    return None


def main(target: str) -> None:
    for part, (repo, revision, files) in MODELS.items():
        out = Path(target) / part
        out.mkdir(parents=True, exist_ok=True)
        for name, expected in files.items():
            url = f"https://huggingface.co/{repo}/resolve/{revision}/{name}"
            digest = hashlib.sha256()
            with urllib.request.urlopen(url, timeout=120) as response, open(out / name, "wb") as f:
                while chunk := response.read(1 << 20):
                    digest.update(chunk)
                    f.write(chunk)
            if digest.hexdigest() != expected:
                sys.exit(f"{part}/{name}: checksum mismatch ({digest.hexdigest()})")
            print(f"{part}/{name}: ok")
    chars = characters(yaml.safe_load((Path(target) / "rec" / "inference.yml").read_text()))
    text = "\n".join(chars) + "\n"
    if hashlib.sha256(text.encode()).hexdigest() != DICT_SHA256:
        sys.exit("rec/dict.txt: checksum mismatch")
    (Path(target) / "rec" / "dict.txt").write_text(text)
    print("rec/dict.txt: ok")


if __name__ == "__main__":
    main(sys.argv[1])
