# Ticket 26: the paper without blocking the page

`paintGrain` now fills only the pixels each patch reaches instead of the whole tile for each of its nine repeats. These scripts prove the paper is the same paper and measure what the page gained.

The "before" in both is the real code, not a copy of it: the repository at the commit where this branch left `origin/main`, unpacked with `git archive` into the system's temporary folder and installed there (`repositoryBefore` in `lib.mjs`).

```bash
bash verifications/26-paper-without-blocking-the-page/run.sh
```

| Script | What it proves | Proof |
|---|---|---|
| `01-the-same-paper.mjs` | Runs `pnpm dev` before and after, reads the grain tile the game painted out of Phaser's texture in each, and compares them pixel for pixel: 0 of 1,048,576 pixels differ. The tooth tile, which is not touched, is compared the same way. | `proof/01-the-same-paper.json` (the counts and a sha256 of each tile), `proof/01-the-same-paper.txt`, `proof/01-the-game-before.png`, `proof/01-the-game-after.png` |
| `02-time-to-the-first-frame.mjs` | Builds for production before and after and loads each 7 times in Chromium (new headless, 1280x720 at a pixel ratio of 2): the time to the first frame and the long tasks before it on the build as deployed, `paintGrain`'s time from a CPU profile of the same build unminified. Medians: `paintGrain` 1775 ms to 61 ms, first frame 1965 ms to 260 ms, long tasks before it 1879 ms to 171 ms. | `proof/02-time-to-the-first-frame.json` (every run), `proof/02-time-to-the-first-frame.txt` |

What the numbers are and are not:

- Measured on an Apple M1 Max while other sessions were also using the machine; ticket 22 measured 1.42 s for `paintGrain` on the same build when it was quieter. The before and after here were measured in the same run, one after the other.
- The first frame is the first animation frame after the game's first WebGL draw, in milliseconds from navigation, served from this machine: no download time is in it.
- The two screenshots are of the running game a moment apart in two page loads; they are for looking at. The claim that the paper is the same rests on the tile comparison.
