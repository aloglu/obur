#!/usr/bin/env bash
# Phase 0: OCR benchmark matrix in Docker. Usage: run_matrix.sh <host-label> <threads> <private-dir>
set -euo pipefail
host=$1 threads=$2 priv=$3
here=$(cd "$(dirname "$0")" && pwd)
for config in A B C; do
  for side in 1280 2000 3024; do
    label="$host-$config-$side"
    docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$here:/bench:ro" -v "$priv/labels-prepared/full:/img:ro" \
      -v "$priv/results/ocr:/out" -v "$priv/models/paddle:/models/paddle:ro" obur-ocr-bench:phase0 \
      /bench/bench_ocr.py --config "$config" --max-side "$side" --threads "$threads" --images /img \
      --out "/out/$label.jsonl" --label "$label" 2>&1 | grep -v telemetry | tail -1
  done
done
