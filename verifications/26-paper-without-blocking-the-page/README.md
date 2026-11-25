# Ticket 26: the paper without blocking the page

`paintGrain` now fills only the pixels each patch reaches instead of the whole tile for each of its nine repeats. These scripts prove the paper is the same paper and measure what the page gained.

The "before" in both is the real code, not a copy of it: the repository at the commit where this branch left `origin/main`, unpacked with `git archive` into the system's temporary folder and installed there (`repositoryBefore` in `lib.mjs`).

```bash
bash verifications/26-paper-without-blocking-the-page/run.sh
```

| Script | What it proves | Proof |
|---|---|---|
| `01-the-same-paper.mjs` | Runs `pnpm dev` before and after, reads the grain tile the game painted out of Phaser's texture in each, and compares them pixel for pixel: 0 of 1,048,576 pixels differ, in Playwright's headless shell and in Chromium itself (new headless, the same engine as Chrome). The tooth tile, which is not touched, is compared the same way. | `proof/01-the-same-paper.json` (the counts and a sha256 of each tile), `proof/01-the-same-paper.txt`, `proof/01-the-game-before.png`, `proof/01-the-game-after.png` |
| `02-time-to-the-first-frame.mjs` | Builds for production before and after and loads each 7 times in Chromium (new headless, 1280x720 at a pixel ratio of 2): the time to the first frame and the long tasks before it on the build as deployed, `paintGrain`'s time from a CPU profile of the same build unminified. Medians: `paintGrain` 1725 ms to 71 ms, first frame 2183 ms to 259 ms, long tasks before it 2086 ms to 168 ms. | `proof/02-time-to-the-first-frame.json` (every run), `proof/02-time-to-the-first-frame.txt` |

What the numbers are and are not:

- Measured on an Apple M1 Max, before and after in the same run, one after the other. Ticket 22's findings have 1.42 s for `paintGrain` before; the 1.72 s here was not looked into, and a busier machine is the likely reason.
- `paintGrain`'s time comes from the production build left unminified (`vite build --minify false`), because the minified one has no function names to find in a profile. The first frame and the long tasks are from the build as deployed, where the longest task before the first frame went from 1989 ms to 89 ms.
- The tiles are equal in Chromium, and because Phaser makes a texture's canvas with `willReadFrequently: true`, which keeps it rasterised on the CPU. A reviewer of this ticket painted the same tile on a canvas rasterised on the GPU, which the game does not use, and found 3 pixels of it off by 1 of 255. Firefox and Safari were not compared.
- The first frame is the first animation frame after the game's first WebGL draw, in milliseconds from navigation, served from this machine: no download time is in it.
- The two screenshots are of the running game a moment apart in two page loads; they are for looking at. The claim that the paper is the same rests on the tile comparison.
