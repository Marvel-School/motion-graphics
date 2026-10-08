#!/usr/bin/env bash
# Installs what the render needs. Silent when everything is already there.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v ffmpeg >/dev/null || { echo "ffmpeg is missing. On a Mac: brew install ffmpeg"; exit 1; }
encoders="$(ffmpeg -hide_banner -encoders 2>/dev/null)"
[[ "$encoders" == *prores_ks* ]] || { echo "this ffmpeg has no ProRes encoder (prores_ks)"; exit 1; }

[ -d node_modules/playwright ] || npm install --silent --no-audit --no-fund >/dev/null
node -e "require('playwright').chromium.executablePath()" >/dev/null 2>&1 \
  && [ -e "$(node -e "console.log(require('playwright').chromium.executablePath())")" ] \
  || npx --yes playwright install chromium >/dev/null

echo "ready"
