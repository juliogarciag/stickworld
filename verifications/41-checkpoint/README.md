# Verifications for #41: a checkpoint the stick man restarts from after a death

```bash
bash verifications/41-checkpoint/run.sh
```

| Script | What it proves | Proof |
|---|---|---|
| `01-restarts-at-the-checkpoint-after-a-death.mjs` | In Chromium against `pnpm dev`, with real keys, on level 3: the mark is on the sheet and in view; a death before the checkpoint restarts the level at its start; the checkpoint is passed as the stick man walks past it; two deaths after that each restart the level at the checkpoint, with the stick man standing and no page turned; the level loaded afresh has the checkpoint not passed. Places are read from the level's data through `window.__game`. | `proof/01-*.json`, `.txt`, four screenshots |

The rules themselves (another level and a game started over forget the checkpoint; a jump over it does not pass it) are held by `packages/sim/src/features/checkpoint/checkpoint.test.ts`, and that level 3 is still finished the intended way by `content/levels/level3.test.ts`. That the mark looks different once passed is shown by the two screenshots and held by `client/src/render/checkpoint.test.ts`.
