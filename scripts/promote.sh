#!/usr/bin/env bash
# Releases main to stable: the branch every user's conversation clones.
# Stops before pushing anything if the tests or a starter check fail.
set -euo pipefail
cd "$(dirname "$0")/.."

[ "$(git branch --show-current)" = main ] || { echo "promote from main"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "commit or stash your changes first"; exit 1; }
git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "main differs from origin/main; push or pull first"; exit 1; }

npm test --silent
bash scripts/check-starters.sh

# A plain push refuses anything but a fast-forward, so stable never loses history.
git push -q origin main:stable
echo "stable is now $(git rev-parse --short HEAD)"
