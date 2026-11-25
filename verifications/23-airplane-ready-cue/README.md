# 23: a cue when the airplane is ready to board

What is verified, from the player's side, on level 3 with the keys a person presses: the hint "take the airplane to the edge" while the airplane is folded and while it is carried to the edge, the words "the airplane is ready" in green the moment it is put down on the edge (on the same read of the sim that says it sits there and that K boards it), and boarding it with K, after which nothing is said about the edge.

Green is measured, not only shown: each screenshot's bottom left quarter, where the prompts are, is counted for clearly green pixels.

```bash
bash verifications/23-airplane-ready-cue/run.sh
```

| Script | What it proves | Proof |
|---|---|---|
| `01-ready-cue-on-level-3.mjs` | The hint before, the green "ready" cue the moment the airplane sits on the edge, boarding with K | `proof/01-ready-cue-on-level-3.json`, `proof/01-ready-cue-on-level-3.txt`, `proof/01-folded.png`, `proof/02-before-carried-to-the-edge.png`, `proof/03-after-ready-on-the-edge.png`, `proof/04-boarded.png` |
