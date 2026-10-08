#!/usr/bin/env bash
# Applies the example brand to every starter and runs check.mjs on it, landscape and portrait.
# One at a time: parallel apply-brand runs break the shared font install.
set -euo pipefail
cd "$(dirname "$0")/.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
for t in templates/*/; do
  name="$(basename "$t")"
  for shape in landscape portrait; do
    dir="$work/$shape/$name"
    mkdir -p "$(dirname "$dir")"
    cp -r "$t" "$dir"
    if [ "$shape" = portrait ]; then
      sed -i.bak -E 's/width: *1920, *height: *1080/width: 1080, height: 1920/' "$dir/clip.html"
    fi
    node scripts/apply-brand.mjs brands/example "$dir" >/dev/null
    node scripts/check.mjs "$dir/clip.html"
  done
done
