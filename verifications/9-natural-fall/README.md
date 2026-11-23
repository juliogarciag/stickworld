# Ticket 9: a fall with momentum, a lean, and arms that catch on the line

What is verified, in the real app (`PORT=5909 pnpm dev`, Chromium, the keys a player uses):

- Walking off the near end of level 2's gap and letting go of the key: he keeps the speed he walked at and is carried over the gap, the far end of the gap stops him, he drops straight beside it, and the level starts again.
- Standing at the edge, hopping past it and stopping the drift: he comes down beside the near end of the line, closer than half his width, and the end pushes him clear a little every frame.
- A running jump still crosses the gap and reaches the flag; level 1 is still finished by walking.
- How it looks, which cannot be checked: pictures of the same moments before and after, and a recording.

The headless tests that prove the rules themselves are in `packages/sim/src/features/player/player.test.ts`, `packages/sim/src/content/levels/` and `packages/client/src/render/stickMan.test.ts`.

## Run it

```bash
bash verifications/9-natural-fall/run.sh
```

The "before" pictures come from the branch this ticket starts from, so they are taken once by hand and are not part of `run.sh`:

```bash
git worktree add --detach /tmp/before origin/3-level-2 && (cd /tmp/before && pnpm install)
BEFORE_ROOT=/tmp/before node verifications/9-natural-fall/00-before.mjs
```

## What is here

| Script | What it proves | Proof |
|---|---|---|
| `01-fall.mjs` | The 18 checks above, read from the sim through `window.__game` while the keys are pressed | `proof/01-fall.txt`, `proof/01-fall.json` |
| `01-fall.mjs` | The look after: a forward fall and a straight drop at four depths below the line, and a jump over the gap | `proof/after-walk-off-*.png`, `proof/after-straight-drop-*.png`, `proof/after-jump-over-the-gap.png` |
| `01-fall.mjs` | How it moves: a forward fall, a straight drop, a jump across the gap to the flag, level 1 | `proof/fall.mp4`, `proof/fall.gif` |
| `00-before.mjs` | The look before, with the same keys at the same depths: he drops straight down with his head and arm across the line | `proof/before-walk-off-*.png`, `proof/00-before.txt`, `proof/00-before.json` |
| `scenes.mjs` | Nothing by itself: the moves both scripts share | |

Each picture is taken on the frame his feet pass its depth, in a fall played for that picture alone; the file name has the depth asked for and the JSON report has where he was.
