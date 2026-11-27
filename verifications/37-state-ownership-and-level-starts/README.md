# Verifications for #37, #38 and #39

Three changes to how the sim is put together, none of which should change how the game plays:

- #37: no feature imports another feature's `state.ts`; the airplane changes the stick man through `features/player/body.ts`.
- #38: every slice says whether it carries across levels.
- #39: a level asked for during a tick starts once every feature has had the tick.

So what is verified is that the game plays exactly as before, in the sim and in the real app, and that the two new rules are enforced.

```bash
bash verifications/37-state-ownership-and-level-starts/run.sh
```

| Script or file | What it proves | Proof |
|---|---|---|
| `01-plays-the-same-as-before.mjs` | Builds the sim from the commit this branch was cut from and from the working tree, and plays the same 52 games on both (a scripted player that finishes the game after falling into the gap, losing flights and jumping out of the airplane, and 40 games of random keys): after every one of about 137,000 ticks the whole state hashes the same. It also counts that each of the four callers of a level start happened in those games (a fall, a lost flight, a flag, playing again). | `proof/01-plays-the-same-as-before.json`, `.txt` |
| `02-dies-and-turns-the-page-in-the-browser.mjs` | In Chromium against `pnpm dev`, with real keys: falling into level 3's gap starts the level again with no page turn, and the key still held walks him on; reaching level 1's flag starts level 2 with the page turning from the very frame the level changes. | `proof/02-*.json`, `.txt`, four screenshots |
| (run by hand, once) | `pnpm lint` on the commit where a test still imported `../player/state`: the new rule rejects it. | `proof/lint-rejects-another-features-state.txt` |
| (run by hand, once) | `tsc` on a slice declared without `carriesAcrossLevels`: it does not compile. | `proof/a-slice-must-say-whether-it-carries.txt` |

What the scripts cannot show: that the code is easier to read. That is what the PR is for.
