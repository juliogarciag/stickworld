# 44 - The pencil and the spear

Proof for issue #44, frozen when its PR merges. Both scripts play the practice yard (`VITE_LEVEL=900`: the letter about the spear, the club enemy, a flag behind it) in Chromium against `pnpm dev`, press the keys a person presses (arrows, K, J) and read what happened from `window.__game`. Expected numbers come from the game: the spear's reach is measured from a thrust at nothing, the club's reach from where the enemy's arm and club are.

Run it from anywhere:

```bash
bash verifications/44-the-pencil-and-the-spear/run.sh
```

Last run: 32 checks, 32 passed.

| Script | What it proves | Proof |
|---|---|---|
| `01-letter-sharpen-thrust-enemy-gone.mjs` (19 checks) | In real time, start to end: K reads the letter, which teaches the spear and puts the pencil in the stick man's hand; J sharpens it into the spear in the same slot; J thrusts, and no J is offered until the spear is drawn back; the spear reaches the enemy from further away than the club reaches the stick man; a thrust from outside the club's reach rubs the enemy out, and it is gone; the stick man walks through where it stood to the flag, never struck, the spear still in its hand. | `01-the-whole-way.webm` (the recording, the thrusts included), `01-the-yard.png` to `07-at-the-flag-with-the-spear.png`, `01-letter-sharpen-thrust-enemy-gone.json`, `.txt` |
| `02-reach-recovery-and-dying-with-the-spear.mjs` (13 checks) | A frame at a time, with the page's clock stepped by the script: the point goes further out every frame, level, and drawing it back takes several times longer; a press in the middle of the drawing back changes nothing; standing just outside the club's reach for four seconds the stick man is not struck and the enemy never swings, and the thrust from there rubs it out, more every frame, where it stood; after a fall off the paper, and after being struck down by the club, the level starts again with the spear in the stick man's hand, no letter to read, and the enemy back at its post. | `08-thrust-0-ready.png` to `08-thrust-3-drawn-back-half.png` (the thrust), `09-outside-the-reach-of-the-club.png`, `10-rubbed-out-1.png` to `-3.png`, `11-the-enemy-gone.png`, `12-again-after-a-fall-with-the-spear.png`, `13-struck-down-the-spear-on-the-floor.png`, `02-reach-recovery-and-dying-with-the-spear.json`, `.txt` |

`game.mjs` is what the two scripts share: the dev server on the yard, the page, reading the game, holding a key until something is true, and stepping the page's clock a frame at a time. `lib.mjs` is the template's.

The look before this ticket: on `main` the yard has no letter and no item is drawn in the stick man's hand (`verifications/43-the-club-enemy/proof/` is that state); `01-the-yard.png` here is the same yard with the letter in it.

Known in the proof: `02-reading-the-letter.png` shows the letter held up over the level's name, which is still on the sheet for its first seconds. The yard's letter is three metres from the start; level 4 (#45) should put its letter where the name is gone by the time it is read.
