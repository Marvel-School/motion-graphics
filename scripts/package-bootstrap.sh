#!/usr/bin/env bash
# Builds the ZIP the user uploads once in Claude (Customize > Skills).
#   bash scripts/package-bootstrap.sh <owner>/<repo>
set -euo pipefail
cd "$(dirname "$0")/.."
repo="${1:?usage: package-bootstrap.sh <owner>/<repo>}"
out="out/motion-graphics.zip"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/motion-graphics" out
sed "s#__REPO_URL__#https://github.com/$repo#" bootstrap/SKILL.md > "$work/motion-graphics/SKILL.md"
rm -f "$out"
(cd "$work" && zip -qr - motion-graphics) > "$out"
echo "$out  clones https://github.com/$repo (branch stable)"
