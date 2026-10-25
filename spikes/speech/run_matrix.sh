#!/usr/bin/env bash
# Phase 0: run the speech benchmark matrix. Usage: run_matrix.sh <host-label> <threads> <private-dir> [config...]
# A config is model:language:beam:prompt(0|1):concurrency, e.g. large-v3-turbo:auto:5:0:1
set -euo pipefail
host=$1 threads=$2 priv=$3; shift 3
configs=("$@")
if [ ${#configs[@]} -eq 0 ]; then
  configs=(small:auto:5:0:1 small:tr:5:0:1 medium:auto:5:0:1 medium:tr:5:0:1
           large-v3-turbo:auto:5:0:1 large-v3-turbo:tr:5:0:1
           large-v3-turbo:auto:5:1:1 large-v3-turbo:tr:5:1:1 large-v3-turbo:auto:1:1:1)
fi
for c in "${configs[@]}"; do
  IFS=: read -r model lang beam prompt conc <<<"$c"
  label="$host-$model-$lang-b$beam"
  if [ "$prompt" = 1 ]; then label="$label-prompt"; fi
  if [ "$conc" != 1 ]; then label="$label-c$conc"; fi
  extra=(); if [ "$prompt" = 1 ]; then extra=(--prompt-file /cfg/prompt.txt); fi
  docker run --rm -v "$priv/models:/models" -v "$priv/audio/raw:/audio:ro" -v "$priv/audio:/cfg:ro" \
    -v "$priv/results/speech:/out" obur-speech-bench:phase0 --model "$model" --threads "$threads" \
    --language "$lang" --beam "$beam" --concurrency "$conc" "${extra[@]}" --clips /audio \
    --out "/out/$label.jsonl" --label "$label" 2>&1 | tail -1
done
