# 35 - Make the owner's 2 m jump the game's jump

Proof that a fresh game, with no movement panel touched, plays the owner's 2 m jump with the real keys, that the let-go of the jump is sent in every key case, that his pose reads at the new arc, and that levels 1 to 3 are still finished the intended way and refuse their shortcuts.

Run from anywhere (the first run installs Playwright in this folder):

```bash
bash verifications/35-two-metre-jump-by-default/run.sh
```

Each script starts its own `PORT=<n> pnpm dev` (5935, 5936 and 5937), drives Chromium with real key presses, reads the sim through `window.__game`, and writes into `proof/`.

| Script | What it proves | Proof |
|---|---|---|
| `01-the-jump-by-keys.mjs` | A fresh game plays the owner's numbers. Space, ArrowUp and W held jump 2 m, tapped hop, held a fifth of a second land in between. (That the rise and fall are even is held tick by tick by the sim test `rises and falls evenly` in `movementTuning.test.ts`: counted in browser frames, one slow frame moves it by several ticks.) A window that loses focus mid-jump cuts the rise, and the key repeating when focus comes back does not jump him again. Let go over an edge he stops sideways within a tenth of a second, and never falls faster than 10 m/s. Jumping out of the airplane: tapped, a hop; held, a full jump. | `01-the-jump-by-keys.json`, `.txt`, `video-01/*.webm` |
| `02-levels-1-to-3.mjs` | A fresh game played through levels 1 to 3 with the keys: level 1 walked; level 2's gap walked into and refused, then crossed with a held jump; level 3's gap jumped with a full jump and refused, then the letter read, the airplane made, set on the edge, boarded and flown across with a climb, and the last flag reached. | `02-levels-1-to-3.json`, `.txt`, `level-*.png`, `video-02/*.webm` (the recording of the new jump through levels 1 to 3) |
| `03-poses.mjs` | His pose, played in real time and recorded, the recording's frames laid out in one sheet each (15 a second; needs `ffmpeg`): a held jump with the game's jump (`pose-held-current.png`) and with the jump the game had before, chosen through the movement panel's kept choice (`pose-held-smallJump.png`), a tap hop (`pose-tap-current.png`), and a long fall that reaches his fastest fall (`pose-long-fall.png`). Each run is checked to be under its own tuning from start to end. | `03-poses.json`, `.txt`, `pose-*.png`, `video-03-*/*.webm` |

`game.mjs` holds what the scripts do to the page (open a fresh game, follow him frame by frame, press keys, get the airplane ready on level 3's edge). Headless Chromium has no audio device, so Phaser's AudioContext error is not counted as a page error.
