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
| `01-game-time-follows-real-time.mjs` | For the CPU slowed 4x and 6x, for frames at 30 Hz, and for neither: over the first 120 frames, the 120 after the tab is hidden for 2 s and shown again, and 120 while the window is not focused, game time is 97% to 103% of real time, he walks at 97% to 103% of the sim's walk speed, and at most one frame was longer than the loop's cap; the 2 s hidden give the sim no more than one capped frame on return; no page errors. 42 checks, all pass. | `proof/after.txt`, `proof/after.json` |
| same, on the code as it was | 19 of the 42 fail: every game time and walk speed check at 4x, 6x and 30 Hz, and game time over the first 120 frames at 60 Hz. | `proof/before.txt`, `proof/before.json` |
| same | The level's name is still being written after a first frame that took seconds: the view's clocks take no more of a frame than the sim does. Shown, not asserted; the JSON has Phaser's frame and the sim's tick before and after the screenshot (`screenshotOfTheFirstFrames`). | `proof/after-cpu-6x-the-sheet-in-its-first-frames.png` (before: `proof/before-cpu-6x-the-sheet-in-its-first-frames.png`, where the name has not started) |

## Before and after

Share of full speed over 120 frames, from `proof/before.json` and `proof/after.json`:

| Frames long because | When | Game time, before | Game time, after | Walk speed, before | Walk speed, after | Frames over the cap, before / after |
|---|---|---|---|---|---|---|
| CPU 4x | first 120 frames | 69.6% | 99.4% | 79.0% | 99.3% | 1 / 1 |
| CPU 4x | after the tab is shown again | 78.3% | 100.0% | 78.2% | 100.0% | 0 / 0 |
| CPU 4x | window not focused | 85.1% | 100.0% | 85.1% | 100.0% | 0 / 0 |
| CPU 6x | first 120 frames | 46.7% | 99.6% | 50.9% | 99.5% | 1 / 1 |
| CPU 6x | after the tab is shown again | 51.1% | 100.0% | 51.1% | 100.0% | 0 / 0 |
| CPU 6x | window not focused | 44.5% | 99.5% | 44.5% | 99.5% | 0 / 0 |
| 30 Hz | first 120 frames | 49.8% | 99.6% | 50.0% | 99.6% | 0 / 1 |
| 30 Hz | after the tab is shown again | 50.0% | 100.0% | 50.0% | 100.0% | 0 / 0 |
| 30 Hz | window not focused | 51.3% | 100.0% | 51.3% | 100.0% | 0 / 0 |
| neither (60 Hz) | first 120 frames | 88.8% | 99.3% | 99.2% | 100.0% | 1 / 1 |
| neither (60 Hz) | after the tab is shown again | 100.0% | 100.0% | 100.0% | 100.0% | 0 / 0 |
| neither (60 Hz) | window not focused | 100.0% | 100.0% | 100.0% | 100.0% | 0 / 0 |

The before numbers at 4x move from run to run with how busy the machine is (a frame there is close to a sixtieth of a second, some under and some over); the after numbers do not depend on how long a frame is.

## How it measures

- 120 is Phaser's own number, `game.loop.panicMax`: how many frames its cap lasted after a start, a show or a focus.
- Real time is all of every frame up to the loop's one cap, `window.__game.maxFrameSeconds`. Most first-120 windows have one frame over it, the one the paper is made in (1.7 s to 11 s): the game is meant to drop the rest of that frame. Whether that frame falls inside the window depends on whether Phaser's first frame came before the paper was made, which is why the 30 Hz run has it after and not before. A check holds it to one frame at most. Before, that frame gave the sim a sixtieth of a second, which is why game time over the first 120 frames at 60 Hz was under full speed too.
- His walk speed is not a second, independent measurement: it is the metres he walked over real time, against the same metres over the game time the same frames gave him, so it is game time against real time once more, over the frames he was walking. Nothing is typed in from the tuning, and the "sim's 2.20 m/s" the checks print is worked out from the same frames. His walk starts when the key arrives, a few frames in, which is after the long frame: over the first 120 frames his share is therefore higher than game time's before the change.
- Level 1 has 9 m of floor from where he starts to the flag, about 4 s of walking. At 30 Hz and at 6x, 120 frames take that long, so he reaches the flag just before the window ends and his walk is measured up to the flag. The level changes 1.1 s after that; a window that ran into it would fail the "measured on one level" check, not pass by mistake.
- Headless Chromium never really hides a page, so the script shows the page what a hidden tab is shown: frames stop, `document.hidden` is true and `visibilitychange` is dispatched; then the reverse. The window losing focus is a `blur` event on `window`. 30 Hz is every other frame of the browser's. Not covered: a real tab switch in a headed browser.
- That the time a tab was hidden is not played on return is Phaser's doing before it is the cap's: it starts counting again when the tab is shown. The check allows one capped frame and sees 0 to 2 ticks.
- A frame's time is the time `requestAnimationFrame` gives it, the clock Phaser reads.
