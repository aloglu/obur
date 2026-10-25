#!/usr/bin/env bash
# Phase 0: same matrix as run_matrix.sh, for obur-lab where there is no Docker.
# Usage: run_matrix_venv.sh <host-label> <threads> <work-dir> [config...]
set -euo pipefail
host=$1 threads=$2 work=$3; shift 3
configs=("$@")
if [ ${#configs[@]} -eq 0 ]; then
  configs=(small:auto:5:0:1 small:tr:5:0:1 medium:auto:5:0:1 medium:tr:5:0:1
           large-v3-turbo:auto:5:0:1 large-v3-turbo:tr:5:0:1
           large-v3-turbo:auto:5:1:1 large-v3-turbo:tr:5:1:1 large-v3-turbo:auto:1:1:1)
fi
export HF_HOME="$work/models" HF_HUB_DISABLE_TELEMETRY=1 BENCH_VERSIONS="$work/speech/requirements.lock"
for c in "${configs[@]}"; do
  IFS=: read -r model lang beam prompt conc <<<"$c"
  label="$host-$model-$lang-b$beam"
  if [ "$prompt" = 1 ]; then label="$label-prompt"; fi
  if [ "$conc" != 1 ]; then label="$label-c$conc"; fi
  extra=(); if [ "$prompt" = 1 ]; then extra=(--prompt-file "$work/audio/prompt.txt"); fi
  echo "$(date -Is) load: $(cut -d' ' -f1-3 /proc/loadavg)"
  "$work/speech/.venv/bin/python" -I "$work/speech/bench.py" --model "$model" --threads "$threads" \
    --language "$lang" --beam "$beam" --concurrency "$conc" "${extra[@]}" --clips "$work/audio/raw" \
    --out "$work/results/speech/$label.jsonl" --label "$label" 2>&1 | tail -1
done
