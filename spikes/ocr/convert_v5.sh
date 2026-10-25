#!/usr/bin/env bash
# Phase 0 (run in the obur-paddle-convert image from Dockerfile.convert): convert PaddlePaddle's PP-OCRv5 mobile detector and Latin recogniser to ONNX.
set -euo pipefail
for m in PP-OCRv5_mobile_det latin_PP-OCRv5_mobile_rec; do
  mkdir -p "/m/${m}_onnx"
  paddle2onnx --model_dir "/m/src/$m" --model_filename inference.json --params_filename inference.pdiparams \
    --save_file "/m/${m}_onnx/inference.onnx" --opset_version 14 2>&1 | tail -2
  cp "/m/src/$m/inference.yml" "/m/${m}_onnx/"
done
python - <<'PY'
import yaml
y = yaml.safe_load(open("/m/latin_PP-OCRv5_mobile_rec_onnx/inference.yml", encoding="utf-8"))
chars = y["PostProcess"]["character_dict"]
open("/m/latin_PP-OCRv5_mobile_rec_onnx/dict.txt", "w", encoding="utf-8").write("\n".join(map(str, chars)) + "\n")
print("latin dict", len(chars), "turkish:", all(c in chars for c in "çğıİöşüÇĞÖŞÜ"))
PY
cat /versions.txt | grep -i paddle
