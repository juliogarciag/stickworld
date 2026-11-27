# Verifications for #41: a checkpoint he restarts from after a death

```bash
bash verifications/41-checkpoint/run.sh
```

| Script | What it proves | Proof |
|---|---|---|
| `01-a-death-past-the-checkpoint-starts-him-there.mjs` | In Chromium against `pnpm dev`, with real keys, on level 3: the mark is on the sheet and in view; a death before it starts him at the level's start; it is passed as he walks past it; two deaths after it each start him at the mark, standing, with no page turned; the level loaded afresh knows nothing of it. Places are read from the level's data through `window.__game`. | `proof/01-*.json`, `.txt`, four screenshots |

The rules themselves (the next level and a game started over forgetting it, not passing it in the air) are held by `packages/sim/src/features/checkpoint/checkpoint.test.ts`, and that level 3 is still finished the intended way by `content/levels/level3.test.ts`. That the mark looks different once passed is shown by the two screenshots and held by `client/src/render/checkpoint.test.ts`.
