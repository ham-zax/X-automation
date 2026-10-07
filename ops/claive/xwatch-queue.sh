#!/usr/bin/env bash
# Queue the xwatch goal if none is pending, rotating the watchdog's own model per half hour
# so a failing free model cannot silence the watchdog for more than one cycle.
set -u
models=(mimo-v2.6-flash-free big-pickle space-bunny-free)
model=${models[$(( $(date +%s) / 1800 % ${#models[@]} ))]}
[ "$(claive goal list --json | jq length)" = 0 ] || exit 0
exec claive goal add --title xwatch --prompt-file /home/ubuntu/work/scratch/xwatch/goal.md \
  --workspace /home/ubuntu/work/scratch --write --budget 25m --max-attempts 1 --engine pi --model "$model"
