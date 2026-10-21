#!/bin/sh
# Copies the Jahbadh grades engine (single source: packages/shared-utils/src/jahbadh/) into the
# backend and the web, which are not npm workspaces and are deployed on their own.
# Re-run after editing the engine or the distribution; jahbadh-sync.test.ts fails on drift.
#   sh packages/shared-utils/scripts/sync-jahbadh-engine.sh
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SRC="$ROOT/packages/shared-utils/src/jahbadh"
for DEST in "$ROOT/backend/src/lib/jahbadh" "$ROOT/frontend/src/lib/jahbadh"; do
  mkdir -p "$DEST"
  for F in distribution.ts engine.ts analytics.ts ideas.ts control.ts timer.ts index.ts; do
    {
      echo "// GENERATED from packages/shared-utils/src/jahbadh/$F by scripts/sync-jahbadh-engine.sh — do not edit."
      cat "$SRC/$F"
    } > "$DEST/$F"
  done
done
echo "synced jahbadh engine to backend and frontend"
