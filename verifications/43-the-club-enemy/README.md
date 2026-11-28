# 43 - The club enemy

What is verified: the club enemy and the struck death, in the real app (`VITE_LEVEL=900 pnpm dev`, the practice yard), with the keys a player has. Every expected number is read from the page through `window.__game` (the level's data, the enemy's def, the sim's view functions); none is typed into a script, but for two: the bounds on how long the stick man lies struck (0.8 to 2.5 s; the pause itself is the sim's `PLAYER.struckPause`, held by `struck.test.ts`) and where the script jumps from (1 m in front of the enemy). The headless side of the same promises is `pnpm test` (`features/enemy/enemy.test.ts`, `features/player/struck.test.ts`, `content/levels/clubYard.test.ts`, `core/blow.test.ts`, `render/enemy.test.ts`, the struck poses in `render/stickMan.test.ts`).

Run it from anywhere; the first run installs Playwright in the folder:

```bash
bash verifications/43-the-club-enemy/run.sh
```

25 checks in two scripts, each with a video of the whole run. Pictures are taken with the game stopped on the frame they show (`takePictureWhen` in `game.mjs` puts Phaser's loop to sleep for the length of the screenshot), so what a check reads is what its picture shows.

| Script | What it proves | Proof |
|---|---|---|
| `01-the-enemy-swings-and-strikes.mjs` | `VITE_LEVEL=900` starts on the yard; the enemy waits at its post, floating; it sees the stick man from its sight distance, turns and comes towards it inside the stretch it guards; it winds up before it swings; the swing strikes the stick man who stayed, knocked away from the enemy; struck, J and K would do nothing and no key moves the stick man; after the pause the level starts again with the enemy back at its post; walking in again is struck again | `01-the-enemy-swings-and-strikes.json`, `.txt`, `01-it-comes-for-the-stick-man.png`, `02-the-club-goes-back.png`, `03-struck-by-the-swing.png`, `04-going-down.png`, `05-lying-where-it-fell.png`, `01-the-swing.webm` (the recording of the swing) |
| `02-its-body-and-the-way-past.mjs` | Walking away when the club goes back gets out of reach; the swing goes over the top, higher than the stick man jumps; the body stops a walk half a stick man from its side and does not hurt; a jump over it as it winds up is struck in the air and falls beside it; a jump while it lifts its club clears it, lands on the far side and reaches the flag; the enemy does not follow past its stretch; under the flag the stick man is left alone | `02-its-body-and-the-way-past.json`, `.txt`, `06-the-swing-at-nothing.png`, `07-up-against-its-body.png`, `08-caught-in-the-air.png`, `09-over-it-while-it-lifts-its-club.png`, `10-at-the-flag-behind-it.png`, `02-the-way-past.webm` |

Before and after: `00-before-on-main.png` is `origin/main` (5e831c8) started with the same `VITE_LEVEL=900 pnpm dev`: there is no level 900 there, so it falls back to level 1, and there is no enemy anywhere in the game. It was taken once by hand from a copy of `origin/main` and is not made again by `run.sh`. Every other picture is the after.

`lib.mjs` is the template's, unchanged. `game.mjs` is this ticket's: opening the yard with a video, reading the sim, waiting for a moment in it and taking its picture.
