# Ticket 25: game time follows real time from the first frame

What is verified: with frames longer than a sixtieth of a second, the game no longer runs in slow motion for its first 120 frames, after the tab is hidden and shown again, or while the window is not focused. Measured on the real app (`PORT=5925 pnpm dev`, Chromium drawing with the GPU) from the sim's own state, `window.__game`, with the right arrow held.

## Run it

```bash
bash verifications/25-game-time-follows-real-time/run.sh
```

It writes `proof/after.json`, `proof/after.txt` and a screenshot. `proof/before.*` is the same script on the code as it was: this branch with the `fps: { smoothStep: false }` line taken out of `packages/client/src/main.ts`, run with `PROOF_NAME=before bash run.sh`. That run is meant to fail.

## What it proves

| Script | What it proves | Proof |
|---|---|---|
| `01-game-time-follows-real-time.mjs` | For the CPU slowed 4x and 6x, for frames at 30 Hz, and for neither: over the first 120 frames, the 120 after the tab is hidden for 2 s and shown again, and 120 while the window is not focused, game time is 97% to 103% of real time and he walks at 97% to 103% of the sim's walk speed; the 2 s hidden are not played on return; no page errors. 30 checks. | `proof/after.txt`, `proof/after.json`, `proof/before.txt`, `proof/before.json` |
| same | The level's name is still being written after a first frame that took seconds: the view's clocks take no more of a frame than the sim does. Shown, not asserted. | `proof/after-cpu-6x-the-sheet-in-its-first-frames.png` (before: `proof/before-cpu-6x-the-sheet-in-its-first-frames.png`, where the name has not started) |

## Before and after

Share of full speed, game time against real time over 120 frames (he walks at the same share):

| Frames long because | When | Before | After |
|---|---|---|---|
| CPU 4x | first 120 frames | 63.6% | 99.4% |
| CPU 4x | after the tab is shown again | 81.1% | 100.0% |
| CPU 4x | window not focused | 89.6% | 99.3% |
| CPU 6x | first 120 frames | 46.9% | 99.6% |
| CPU 6x | after the tab is shown again | 48.8% | 100.0% |
| CPU 6x | window not focused | 56.1% | 99.6% |
| 30 Hz | first 120 frames | 50.0% | 99.6% |
| 30 Hz | after the tab is shown again | 50.0% | 100.0% |
| 30 Hz | window not focused | 51.3% | 100.0% |
| neither (60 Hz) | first 120 frames | 88.2% | 99.3% |
| neither (60 Hz) | after the tab is shown again | 100.0% | 100.0% |
| neither (60 Hz) | window not focused | 100.0% | 99.2% |

The before numbers at 4x move from run to run with how busy the machine is (a frame there is close to a sixtieth of a second, some under and some over); the after numbers do not depend on how long a frame is.

## How it measures

- Real time is all of every frame up to the loop's one cap, `window.__game.maxFrameSeconds`. Each run has one frame over it in its first 120, the one the paper is made in (2 s to 11 s): the game is meant to drop the rest of that frame. Before, it also got a sixtieth of a second for that frame, which is why the 60 Hz row was under full speed too.
- His walk speed is the sim's own: metres walked over the game time the same frames gave him. Nothing is typed in from the tuning.
- Headless Chromium never really hides a page, so the script shows the page what a hidden tab is shown: frames stop, `document.hidden` is true and `visibilitychange` is dispatched; then the reverse. The window losing focus is a `blur` event on `window`. 30 Hz is every other frame of the browser's. Not covered: a real tab switch in a headed browser.
- A frame's time is the time `requestAnimationFrame` gives it, the clock Phaser reads.
