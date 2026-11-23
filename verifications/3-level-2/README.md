# Ticket 3: level 2, the gap, dying, and the paper

What is verified: in the real app, with the keys a player uses, level 1 leads to level 2; walking into level 2's gap is a death that starts the level again; a jump clears the gap; the flag past it puts the paper in item slot 1; and the 1 key selects and unselects that slot. What the sim holds is read through `window.__game`; what the HUD draws is measured in screenshots as the amount of pencil where the slot is.

Run it (from anywhere; the first run installs Playwright in this folder):

```bash
bash verifications/3-level-2/run.sh
```

It starts its own dev server on port 5913 and stops it when done.

| Script | What it proves | Proof |
|---|---|---|
| `01-level-2.mjs` | 23 checks: level 1's flag starts level 2; level 2 has a gap and a flag past it; slot 1 starts empty; walking into the gap he falls below the line and the level starts again within two seconds, in the same sim; the slot is still empty after the death; a jump at the edge crosses with his feet above the line; the paper is in slot 1 from the tick the flag is reached and not before; the HUD draws the slot, the paper, and a second box while selected; 1 selects, 1 again unselects; no page errors | `proof/01-level-2.txt` (the PASS lines), `proof/01-level-2.json` (the states read), `proof/01` to `07-*.png`, `proof/08-death-jump-paper-and-slot.webm` (the whole run) |

Not checked here, because the app cannot reach it yet: the paper surviving a death in a later level. Level 2 is the last level, and he stands at its flag for good. `packages/sim/src/content/levels/level2.test.ts` proves it headlessly.

There is no "before" screenshot: the item slot is new, so every screenshot is an "after". `01-level-2-starts.png` shows the slot empty, `05` with the paper, `06` selected.
