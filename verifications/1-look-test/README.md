# 1 - Look test: how pencil strokes are drawn

Proof for issue #1. Frozen when its PR merges: do not run, repair or copy from it afterwards.

What is verified, on the real app in Chromium (`PORT=5912 pnpm dev`, started and stopped by each script; `00-before.mjs` used 5911): the paper has a grain, level 1's floor is a pencil line exactly where the level's data says the floor is, the stick man stands on it as tall as the sim's tuning says, the lines have a pencil's grain and boil while the paper does not, he walks by himself and with the arrow keys, and none of it is sim state. Expected positions come from `window.__game`, not from numbers in the scripts.

Whether it looks right cannot be asserted: look at the screenshots and the recording.

```bash
bash verifications/1-look-test/run.sh
```

| Script | What it proves | Proof |
|---|---|---|
| `00-before.mjs` | The look before this ticket: flat paper, nothing drawn. Run once on `origin/main`'s code, before the change. | `proof/00-before.png` |
| `01-techniques.mjs` | One still picture per stroke technique tried, whole view and close up. Run once at commit `6321917`, the only one where `VITE_STROKES` picks a technique; it cannot run on a later commit and is not in `run.sh`. | `proof/01-technique-{rope,graphics,canvas}-{view,closeup}.png` |
| `02-look.mjs` | 18 checks: paper grain; the floor line where the level puts it, starting where the floor starts, nothing under it; the line's grain (a flat line measures 0); the stick man on the floor at the sim's height with a drawn, hollow head; a still picture boils in the lines and not in the paper; the same share of the view in a bigger window and at pixel ratios 2 and 3. | `proof/02-look.json`, `02-look.txt`, `02-after.png`, `02-after-retina.png`, `02-after-closeup.png` |
| `03-walk.mjs` | 15 checks: he walks by himself along the floor; the camera keeps him in the middle; his legs and arms swing through the cycle; the left and right arrow keys walk him, no key stands him; at the far end the floor line is still drawn and ends where the level ends it; the sim's snapshot says nothing about him. | `proof/03-walk.json`, `03-walk.txt`, `03-walk.webm` (and `03-walk.gif`, its first seconds), `03-walk-1..4.png`, `03-walking-left.png`, `03-standing.png`, `03-end-of-the-floor.png` |
| `run.sh` (04) | Rule 12 is enforced: lint rejects `add.graphics()` and `make.graphics()` in a file outside `render/strokes/`. | `proof/04-lint-rule.txt` |

The headless half is in the client's tests (`pnpm test`): `render/strokes/handDrawn.test.ts` (the hand-drawn path and the boil), `render/stickMan.test.ts` (the limbs, feet on the floor, the planted foot does not slide), `render/floor.test.ts` and `demo/walkAlongTheFloor.test.ts`.

`lib.mjs` is the template's, plus `lookAt` (what is on screen, as numbers), `differingPixels` and `onScreen` (metres to page pixels through the camera).
