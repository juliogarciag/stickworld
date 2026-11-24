# 15: UX review of the three levels

The captures behind `docs/reviews/ux-review-1.md`. This ticket changes nothing in the game, so there is nothing to pass or fail: the proof is what the real app showed when it was played once at each of three windows.

## What is here

| File | What it is |
|---|---|
| `playthrough.mjs` | Plays levels 1, 2 and 3 in order from a fresh load, with real key presses, and takes a screenshot at every moment the review talks about |
| `proof/wide/` | 1600 × 900: 61 screenshots, four clips (`clip-*.gif`) and `playthrough.txt` |
| `proof/narrow/` | 820 × 760: the same 61 moments and `playthrough.txt` |
| `proof/portrait/` | 480 × 860: the same 61 moments and `playthrough.txt` |

`playthrough.txt` has one line for each capture with what the sim held at that moment (level, tick, where he was, what he was doing, the item slot, the airplane, the letter, what J and K would have done). The times in the review are differences between those ticks, at 60 a second.

## How it was made

With a dev server running from this worktree with no `VITE_LEVEL` (`PORT=5215 pnpm dev`):

```bash
cd verifications/15-ux-review
pnpm install --ignore-workspace --frozen-lockfile
node playthrough.mjs wide
node playthrough.mjs narrow
node playthrough.mjs portrait
```

The script holds the page's clock and moves it one frame at a time (Playwright's `page.clock`), so a screenshot can be taken at any moment of a flight that lasts 1.4 seconds. The game runs as it does in real time; only the waiting between frames is gone. The clips are made the same way, a frame at a time, and put together with `ffmpeg` at the game's real speed. Chromium's own screen recording was tried first and ran the game at about half speed on this machine, which would have been no proof of how long anything takes.

The script reads `window.__game` only to time its key presses (when to jump, when the level changed) and to write `playthrough.txt`. It never queues a command or loads a level through it.
