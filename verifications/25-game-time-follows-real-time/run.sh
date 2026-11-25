#!/usr/bin/env bash
# Runs every verification in this folder and writes proof into ./proof.
# Usage: bash verifications/<this folder>/run.sh   (from anywhere)
set -u
cd "$(dirname "$0")"
repo="$(cd ../.. && pwd -P)"
if [ ! -d node_modules ]; then
  pnpm install --ignore-workspace --frozen-lockfile
  # The full Chromium, not only the headless shell: the script needs the one that draws with the GPU.
  npx playwright install chromium
fi
mkdir -p proof
status=0
# List your scripts here, in the order they should run.
# PROOF_NAME names the proof files: "after" for the change, "before" for a run on the code as it was.
name="${PROOF_NAME:-after}"
for script in 01-game-time-follows-real-time; do
  echo
  echo "=== $script ($name) ==="
  # Console output is proof too: keep machine paths out of it, like writeProof does.
  PROOF_NAME="$name" node "$script.mjs" 2>&1 | sed "s#$repo#<repo>#g" | tee "proof/$name.txt"
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then status=1; fi
done
echo
if [ $status -eq 0 ]; then echo "ALL VERIFICATIONS PASSED"; else echo "SOME VERIFICATIONS FAILED"; fi
exit $status
