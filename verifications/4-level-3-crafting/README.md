# Verification: issue #4, level 3 (crafting and carrying the airplane)

Proof that the first half of level 3 works in the real app, played with the keyboard the way a player plays it: Chromium against `pnpm dev`, every key pressed through the keyboard, the sim read through `window.__game`, and what is on screen counted on screenshots. Expected numbers (where the letter lies, where the floor ends, which item is the paper) come from the level and the defs, not from the scripts.

The headless side of the same promises is in the sim's tests (`pnpm test`): `content/levels/level3.test.ts` (the gap cannot be jumped; the level played as far as the edge) and the tests in `features/letter`, `features/crafting`, `features/airplane` and `features/world`.

## Run it

```bash
bash verifications/4-level-3-crafting/run.sh
```

The first run installs Playwright in this folder. The scripts start their own dev servers on ports 5914 and 5915, so the one left running for the human on 5204 is not touched.

## What is verified

| Script | What it proves | Proof |
|---|---|---|
| `01-read-fold-carry.mjs` | Starting on level 2: its flag gives the paper and level 3 follows. On level 3 the letter lies in front of the start; J with the paper lists nothing before it is read; K reads it and its text is written on the screen; K puts it away; J opens the recipe list, which lists only the paper airplane; J again turns the paper into an airplane in the same slot; J sets it down in front of him; K lifts it over his head; he walks and jumps with it, and on every frame it is over his feet; K near the edge puts it down sitting on the edge, nose out; there K would board it and does nothing yet; carrying shortens the jump. | `proof/01-read-fold-carry.txt`, `.json`, `01` to `08` `.png`, and the recording of the whole run, `01-read-fold-carry.webm` (carrying starts about 20 seconds in) |
| `02-losing-it.mjs` | Level 3 started on its own: the first letter gives the paper to someone who has none. Then the airplane is lost in each of four ways (put down too far past the edge, set down from the slot too far past the edge, carried off the edge, left on the floor when he dies) and each time a new letter falls from the sky to where the old one was, reading it gives a new paper, and the paper folds into a new airplane. No letter falls while he has one. | `proof/02-losing-it.txt`, `.json`, `09` to `12` `.png` |

`play.mjs` holds what the two scripts share: opening the game, pressing keys, reading the sim, and counting pencil pixels in a rectangle of the page. `lib.mjs` and `run.sh` are the template's.

## What a person has to look at

Whether it looks right cannot be asserted: the screenshots and the recording are there for that. The checks only prove that something is drawn where the sim says the letter, the text, the list and the airplane are, and that nothing is drawn there when they are gone.
