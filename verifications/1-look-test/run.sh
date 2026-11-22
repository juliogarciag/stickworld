#!/usr/bin/env bash
# Runs every verification in this folder and writes proof into ./proof.
# Usage: bash verifications/<this folder>/run.sh   (from anywhere)
set -u
cd "$(dirname "$0")"
repo="$(cd ../.. && pwd -P)"
if [ ! -d node_modules ]; then
  pnpm install --ignore-workspace --frozen-lockfile
  npx playwright install chromium
fi
mkdir -p proof
status=0
# List your scripts here, in the order they should run.
for script in 02-look 03-walk; do
  echo
  echo "=== $script ==="
  # Console output is proof too: keep machine paths out of it, like writeProof does.
  node "$script.mjs" 2>&1 | sed "s#$repo#<repo>#g" | tee "proof/$script.txt"
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then status=1; fi
done
# The recording again as a GIF, which a PR description can show inline. Skipped where ffmpeg is not installed.
if [ -f proof/03-walk.webm ] && command -v ffmpeg >/dev/null; then
  # The first seconds, cropped to the stick man (the camera keeps him in the middle), in few colours: the paper's grain makes a full GIF huge.
  ffmpeg -y -loglevel error -t 5 -i proof/03-walk.webm -vf "fps=12,crop=520:320:220:140,split[a][b];[a]palettegen=max_colors=24[p];[b][p]paletteuse=dither=none" proof/03-walk.gif
fi
echo
if [ $status -eq 0 ]; then echo "ALL VERIFICATIONS PASSED"; else echo "SOME VERIFICATIONS FAILED"; fi
exit $status
