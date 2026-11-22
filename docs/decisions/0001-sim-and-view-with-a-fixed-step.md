# 0001 - The sim and the view: a headless sim advanced in fixed steps, and a Phaser view that only draws it

Status: accepted. Date: 2026-11-22.

## Context

Stickworld is a small platformer that many agents will extend in parallel. Each of them has to prove that its change works without a person playing it: that level 2's gap can be jumped, that level 3's cannot, that the airplane stalls when it climbs too steeply. Those proofs only hold if the game's rules can run without a browser and give the same result every time. The look of the game (pencil strokes on paper) is a separate question, and it should be possible to change how things are drawn without touching the rules.

## Decision

- **Two packages.** `packages/sim` holds every rule and every piece of game state, in plain TypeScript with no DOM, no Node APIs and no Phaser. `packages/client` is a Phaser 4 app that reads the sim, draws it and turns key presses into commands. The client imports the sim through `src/index.ts` only. Lint and the sim's `tsconfig` enforce all of this.
- **A fixed step.** The sim advances only through `step(commands)`, one tick of `FIXED_DT` (1/60 s) at a time. The client's `GameLoop` turns real frame time into whole ticks with `takeWholeTicks`, carries the leftover to the next frame, and holds commands until the next earned tick. Nothing else calls `step`.
- **Commands in, state out.** Input reaches the sim only as plain, serializable commands named `'<feature>/<verb>'` for what the player means. Handlers validate every field and ignore what is malformed.
- **State is plain JSON in slices.** Each feature declares its slices of state (`defineSlice`) with the value they start at on a level; the sim keeps them in one record. There is no entity-component library: the world is a line, a few gaps and a handful of objects, and a plain record is easier to read, test and snapshot. A snapshot is that record with the tick, the level and the rng's state; `restoreSim(snapshot)` continues exactly where it was taken. A slice can be declared to carry across levels (the paper the player keeps).
- **Determinism.** Same seed and same commands give the same state. The sim has no `Math.random`, `Date`, timers or I/O; randomness goes through `sim.rng` (mulberry32). `core/determinism.test.ts` replays every level twice and compares hashes.
- **No physics library.** Walking, jumping, carrying and the glide are a few lines of arithmetic inside features. Adding one would be a new ADR.

## Consequences

- A level test is a list of commands and an assertion on the snapshot, run headless in Vitest in milliseconds.
- The view can be replaced or restyled freely; how strokes are drawn is the subject of ADR 0002 and lives in `client/src/render/strokes/` alone.
- Anything the view needs to know about the game must be exported from `sim/src/index.ts`. When the view wants an `if` about game rules, the rule belongs in the sim.
- Slices hold JSON only. A slice holding a Map, a class or a function breaks snapshots, and `core/snapshot.test.ts` fails for it.
- The fixed step means the game runs at 60 ticks a second whatever the display rate; drawing between ticks, if smoothness needs it, is a view concern.
