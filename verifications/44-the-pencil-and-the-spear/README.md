# 44 - The spear, rolled from paper

Proof for issue #44, frozen when its PR merges. The folder keeps the name the ticket had when it started; the pencil it names was taken out before the PR merged, and the spear is rolled from a sheet of paper.

The three scripts play the practice yard (`VITE_LEVEL=900`: the letter about the spear, the club enemy, a flag behind it) in Chromium against `pnpm dev`, press the keys a person presses (arrows, K, J, L) and read what happened from `window.__game`. Expected numbers come from the game: the spear's reach is measured from a thrust at nothing, the club's reach from where the enemy's arm and club are, item and recipe ids from the game's defs by name.

Run it from anywhere:

```bash
bash verifications/44-the-pencil-and-the-spear/run.sh
```

Last run: 44 checks, 44 passed.

| Script | What it proves | Proof |
|---|---|---|
| `01-letter-roll-thrust-enemy-gone.mjs` (19 checks) | In real time, start to end: K reads the letter, which teaches the spear and puts a sheet of paper in the stick man's hand; J rolls it into the spear in the same slot, with nothing to switch to; J thrusts, and no J is offered until the spear is drawn back; the spear reaches the enemy from further away than the club reaches the stick man; a thrust from outside the club's reach rubs the enemy out, and it is gone; the stick man walks through where it stood to the flag, never struck, the spear still in its hand. | `01-the-whole-way.webm` (the recording, the thrusts included), `01-the-yard.png` to `07-at-the-flag-with-the-spear.png`, `01-letter-roll-thrust-enemy-gone.json`, `.txt` |
| `02-reach-recovery-and-dying-with-the-spear.mjs` (13 checks) | A frame at a time, with the page's clock stepped by the script: the point goes out frame after frame, level, and drawing it back takes several times longer; a press in the middle of the drawing back changes nothing; standing just outside the club's reach for four seconds the stick man is not struck and the enemy never swings, and the thrust from there rubs it out, more and more, where it stood; after a fall off the paper, and after being struck down by the club, the level starts again with the spear in the stick man's hand, no letter to read, and the enemy back at its post. | `08-thrust-0-ready.png` to `08-thrust-3-drawn-back-half.png` (the thrust), `09-outside-the-reach-of-the-club.png`, `10-rubbed-out-1.png` to `-3.png`, `11-the-enemy-gone.png`, `12-again-after-a-fall-with-the-spear.png`, `13-struck-down-the-spear-on-the-floor.png`, `02-reach-recovery-and-dying-with-the-spear.json`, `.txt` |
| `03-two-things-to-make-of-paper.mjs` (12 checks) | The choice between the two things paper makes. Knowing only the spear there is nothing to switch and L does nothing. For a stick man that also knows the airplane: J would roll the spear by default and L is offered with the airplane; L switches, and switches back; J without ever pressing L makes the spear; L then J folds the airplane instead; with the paper spent on an airplane a new sheet falls, K picks it up in place of the airplane, and it is for the spear again. | `14-the-spear-chosen-the-airplane-offered.png`, `15-the-airplane-chosen-the-spear-offered.png`, `16-the-airplane-folded-instead.png`, `17-a-new-sheet-fell.png`, `03-two-things-to-make-of-paper.json`, `.txt` |

How script 03 gets a stick man that knows both recipes: no level of the game leads from level 3 to this yard yet (#45). The script reads the letter in the yard, takes `window.__game.takeSnapshot()`, adds the airplane's recipe to the recipes known in it, in front of the spear's, and plays on from that with `window.__game.loadSnapshot()`. Everything after that is keys. Headless tests hold the same through the sim alone (`crafting.test.ts`, `letter.test.ts`).

`game.mjs` is what the scripts share: the dev server on the yard, the page, reading the game, holding a key until something is true, stepping the page's clock a frame at a time, and playing on from a changed snapshot. `lib.mjs` is the template's.

Before and after: `00-before-on-main.png` is the yard on `main` (fbfd2a4) with the stick man standing where the letter now lies: no letter, an empty slot, nothing in its hand, no key offered. It was taken once by hand from a checkout of `main`, not by `run.sh`. `03-the-paper-in-its-hand.png` and `04-the-spear-in-its-hand.png` are the same place after.

Known in the proof: `02-reading-the-letter.png` shows the letter held up over the level's name, which is still on the sheet for its first seconds. The yard's letter is three metres from the start; level 4 (#45) should put its letter where the name is gone by the time it is read. Headless Chromium draws about a dozen frames a second while it records, so script 01 often sees no frame of the tenth of a second the point takes to go out; script 02 steps the clock for that.
