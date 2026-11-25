# Verifications of #24: a 90s-platformer jump to try and tune live

What is verified, against the real app (`pnpm dev` and Chromium):

- The game as it is played does not change: a fresh page plays the current preset, a held jump and a tap both go 0.7 m up, the panel is folded away, and a production build has neither the panel nor lil-gui.
- The owner's loop from the panel: choosing "90s platformer" reaches the sim; held, the jump is twice his height and at its top in a third of a second; a tap is a short hop and a short hold is in between; the jump height knob changes the next jump; in the air he turns and stops on the tick the key says so; an arrow key typed into a knob does not walk him; a reload keeps the choice, a new sim is given it again, and "current" gives the game back as it is.
- The two jumps side by side, recorded: the same moves at the same moments in two games, current on the left and the 90s preset on the right.

The headless sim tests in `packages/sim/src/features/player/movementTuning.test.ts` hold the rules themselves (the cut, the two gravities, the fastest fall, air braking, validation, the snapshot); every existing level test passing unchanged is the proof that the defaults did not move.

Run it from anywhere (the first run installs Playwright here):

```bash
bash verifications/24-retro-jump-sandbox/run.sh
```

The scripts start their own dev server on port 5924, not 5224, the one left running for the owner.

| Script | What it proves | Proof |
|---|---|---|
| `01-current-jump-unchanged.mjs` | The current jump and a production build are as they were | `proof/01-current-jump-unchanged.{json,txt}`, `proof/01-current-with-the-panel-folded.png` |
| `02-nineties-preset-and-knobs.mjs` | The preset, a knob, air control, keys in the panel, kept choices | `proof/02-nineties-preset-and-knobs.{json,txt}`, `proof/02-panel-open-with-the-90s-preset.png` |
| `03-side-by-side-recording.mjs` | Both jumps, side by side | `proof/03-side-by-side.webm`, `proof/03-both-jumps-held-near-the-top.png`, `proof/03-side-by-side-recording.{json,txt}` |

`jumps.mjs` is what the scripts share: opening the game, a jump made with the space key and read after every tick of the sim (frames can be fewer than ticks in a headless browser), and the panel's controls. `lib.mjs` is the template's.
