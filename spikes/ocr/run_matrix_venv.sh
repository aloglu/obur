#!/usr/bin/env bash
# Phase 0: OCR matrix on obur-lab (no Docker there). Usage: run_matrix_venv.sh <host-label> <threads> <work-dir>
set -euo pipefail
host=$1 threads=$2 work=$3
export PADDLE_MODELS="$work/models/paddle" BENCH_VERSIONS="$work/ocr/requirements.lock"
for config in A B C; do
  for side in 1280 2000; do
    label="$host-$config-$side"
    "$work/ocr/.venv/bin/python" -I "$work/ocr/bench_ocr.py" --config "$config" --max-side "$side" --threads "$threads" \
      --images "$work/labels" --out "$work/results/ocr/$label.jsonl" --label "$label" 2>&1 | grep -v telemetry | tail -1
  done
done
