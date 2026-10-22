#!/usr/bin/env bash
# Builds the Premiere panel installer: out/motion-graphics-panel.ccx (a ZIP of panel/ with the
# manifest at its root). Double-click it to install through Creative Cloud.
set -euo pipefail
cd "$(dirname "$0")/.."
out="out/motion-graphics-panel.ccx"
mkdir -p out
rm -f "$out"
(cd panel && zip -qr - manifest.json index.html main.js icons) > "$out"
echo "$out  panel $(node -p "require('./panel/manifest.json').version")"
