# Verification: issue #2, level 1 (walking, jumping and the flag)

What is verified: a player can play level 1 in the real app with the keyboard. The stick man walks with the arrow keys, jumps with space or the up arrow, does not finish the level by stopping short of the flag, finishes it by reaching the flag, and starts again when he falls off the paper. The camera follows him and everything is drawn where the sim says it is.

The rules themselves (walk speed, jump height, both forgiveness windows, the recorded playthroughs of level 1) are proved headless by the sim's tests: `pnpm test`.

## Run it

```bash
bash verifications/2-level-1/run.sh
```

It starts its own dev server on port 5921, drives Chromium with real key presses, reads the sim through `window.__game` and writes into `proof/`.

| Script | What it proves | Proof |
|---|---|---|
| `01-walks-to-the-flag.mjs` | 27 checks: the start of the level, walking right and left, the camera following, a jump while walking and one on the spot, stopping short does not finish, reaching the flag finishes and he cheers, nothing moves him afterwards, falling off the paper starts the level again with the key still held, no page errors | `01-walks-to-the-flag.txt` and `.json`, `01-start.png`, `02-walking.png`, `03-jumping.png`, `04-stopped-short.png`, `05-at-the-flag.png`, `06-falling-off-the-paper.png`, `07-walk-jump-flag.webm` (the walk, two jumps and the flag) |
| `00-before.mjs` | Nothing about this ticket: it took the "before" picture of the look test's stick man on `main` (d47ed3a), for comparison. It ran once before the client changed and cannot run on this branch, so `run.sh` does not list it | `00-before-walking.png`, `00-before.txt` |

How the game looks cannot be asserted: compare `00-before-walking.png` with `02-walking.png` (same line weight, same walk), and look at `03-jumping.png`, `05-at-the-flag.png` and the recording for what is new.
