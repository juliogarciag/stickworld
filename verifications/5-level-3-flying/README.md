# Issue #5: level 3, flying the airplane

Proof that the second half of level 3 works in the real app: Chromium, driven through the real keyboard with Playwright, against `pnpm dev` started on level 3. Every expected number is read from `window.__game` (the level's floor, the airplane and the stick man as the sim has them); the only things typed into the scripts are what a player would decide by eye, such as "let go of up once he is a metre above the line".

The headless proof is in the sim's tests: `packages/sim/src/features/airplane/flight.test.ts` (the rules of the glide, landing, jumping out, dying) and `packages/sim/src/content/levels/level3.test.ts` (recorded flights: one that crosses and reaches the flag, the window of climbs that cross, doing nothing, climbing too long, a save by jumping out).

## Run it

```bash
bash verifications/5-level-3-flying/run.sh
```

The first run installs Playwright in this folder. Each script starts its own dev server (ports 5915 and 5916), prints `PASS`/`FAIL` lines, exits non-zero on a failure and writes into `proof/`.

## What is verified

| Script | What it proves | Proof |
|---|---|---|
| `01-full-flight.mjs` (20 checks) | From the start of level 3: the airplane is carried to the edge, K boards it and it is launched; holding up climbs and costs speed; a walk key does nothing while he is seated; left alone the nose sinks and it glides down, gaining speed; it reaches the far side above the line, comes down on it, slides to a stop and he stands up; he walks to the flag; the game writes "THE END" and no level follows | `proof/01-full-flight.webm` (the recording), `01-ready-to-board.png` to `06-the-end.png`, `01-full-flight.json`, `01-full-flight.txt` |
| `02-falls-and-saves.mjs` (16 checks) | On his feet an up key is still a jump; boarding and doing nothing sinks into the gap, the page names the flight keys while he is seated and a down key dives; then the level starts again, the airplane is lost and a new letter falls; the new letter's paper makes a new airplane; holding up all the way stalls high over the gap and falls short; a climb a little too short is saved by jumping out with space next to the far edge | `proof/02-falls-and-saves.webm`, `07-sinking-into-the-gap.png` to `11-saved-on-the-far-side.png`, `02-falls-and-saves.json`, `02-falls-and-saves.txt` |

`play.mjs` holds what both scripts share: starting the server, opening the page with a recording, reading the sim, and playing level 3 as far as the airplane on the edge. `lib.mjs` is the template's, unchanged.

How the seated stick man, the flying airplane, the flight hints and the end look cannot be asserted, only shown: the screenshots and the two recordings are that proof.
