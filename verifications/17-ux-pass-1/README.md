# Verification of ticket 17: first UX pass

Five changes in one PR, each verified from the player's side in the real app (`pnpm dev`), at three windows: wide (1600 × 900), narrow (820 × 760) and portrait (480 × 860).

Run everything (about twenty minutes; the first run installs Playwright here):

```bash
bash verifications/17-ux-pass-1/run.sh
```

`00-before.mjs` plays the game as it was before this ticket, from the checkout of the branch this one starts from. It expects that checkout next to this worktree (`.worktrees/15-ux-review`); `BEFORE_CHECKOUT=<path>` points it elsewhere. Every other script starts its own dev server from this worktree. `ONLY_WINDOW=wide node <script>` runs one window.

## How the scripts play

`play.mjs` holds the page's clock still (Playwright's `page.clock`) and lets it pass one frame of a sixtieth of a second at a time. Keys are real key presses held for a known number of frames, a screenshot is of a known frame, and a clip is assembled from every fifth frame, so it plays at the game's own speed. What the game is doing is read through `window.__game`. What is on the screen is measured: `inkIn(region)` counts the pixels of a screenshot that are pencil, which is how a script knows that words are written, rubbed out, or inside the window.

Nothing about the levels is typed into a script: gaps, flags, notes and item ids come from `window.__game.level` and `.defs`. Typed in are: the ticket's own number ("about twelve metres"), how long the nose is held up for a flight that crosses, which is inside the window level 3's tests hold, and the regions of the screen a script looks in for what only the view knows (the band a level's name is written in, the band of the window the end is written in).

## What is verified

| Script | Part | What it proves | Proof |
|---|---|---|---|
| `00-before.mjs` | all | The unchanged game does what the UX review said: a cut two seconds after the flag, no far side in view from level 3's edge, an empty slot and a three second wait after a lost flight, a read letter gone, an end that answers no key and is cut off on a portrait window | `proof/00-before.{txt,json}`, `proof/before/<window>/` |
| `01-a-page-turn.mjs` | A | The next level starts about a second after the flag; the finished sheet slides off to the left over most of a second with the next level already played under it; the new sheet has its number and name above him, rubbed out a few seconds later; a page number is in the corner of every sheet | `proof/01-a-page-turn.{txt,json}`, `proof/after/<window>/a-*`, clip at the wide window |
| `02-b-first-sheet.mjs` | B | The game's name is on level 1; a walk note with its keys is beside him and is rubbed out once he has walked on, not before; a jump note is before level 2's gap, still there after a fall into it and rubbed out once he has jumped it; the notes move with the sheet | `proof/02-b-first-sheet.{txt,json}`, `proof/after/<window>/b-*` |
| `03-c-camera.mjs` | C | On every frame from level 3's letter to the landing: the view shows twelve metres or more, never jumps, and the HUD stays the size it is; carrying, at the edge and in flight he is to one side with the level ahead of him; from the edge, before boarding, the far side is in view; after the landing the view eases back | `proof/03-c-camera.{txt,json}`, `proof/after/<window>/c-*`, clip at the narrow window |
| `04-e-retry.mjs` | E | A read letter stays, opened, and is read again; after a lost flight the level starts again with the airplane in his hand and the retry is a walk and two presses; with neither paper nor airplane a new letter still falls and gives the paper | `proof/04-e-retry.{txt,json}`, `proof/after/<window>/e-*` |
| `05-g-ending.mjs` | G | "THE END" is written a stroke at a time and reaches neither side of the window; a key and "PLAY AGAIN" follow; he stands, walks about and cannot walk off the paper; Enter does nothing before it is offered and then turns the page back to level 1 with nothing kept | `proof/05-g-ending.{txt,json}`, `proof/after/<window>/g-*`, clip at the portrait window |

The same moments are captured before and after under the same file names where there is a before (`proof/before/<window>/` and `proof/after/<window>/`).
