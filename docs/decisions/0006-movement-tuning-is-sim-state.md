# 0006 - How he moves is sim state a dev build can tune while the game runs, and letting go of the jump is a command

Status: accepted. Date: 2026-11-25.

## Context

Issue #24: a playtester found the jump to be a normal person's jump (feet 0.7 m up, against a 1.8 m stick man) and asked how a jump like the platformers of the nineties would feel: about twice his height, its height chosen by how long the key is held, a fast rise and a faster fall, and steering in the air that turns and stops him at once. The owner wants to try that and tune it while playing before deciding anything, without changing the game as it is played.

Until now every number of how he moves was a constant in `PLAYER` (`features/player/defs.ts`), read by the player feature's logic. Changing one meant a reload, and a number changed from outside the sim would have been game state the snapshot does not carry (rule 3), and a recorded game would no longer replay (rule 5). A jump whose height depends on how long the key is held also needs the sim to know when the key goes up; until now it only heard that it went down (`'player/jump'`).

## Decision

**The numbers of how he walks, jumps and falls are a slice of sim state, `movementTuning`, which starts as `MOVEMENT_PRESETS.current` (built from `PLAYER`, unchanged) and changes only through a `'player/tuneMovement'` command. Letting go of the jump is a command of its own, `'player/letGoOfJump'`. Only a dev build sends the first, from a panel that is not in a production build.**

- `MovementTuning` (`features/player/defs.ts`) is walk speed, jump height (and with something carried), a gravity for the rise and one for the fall, the fastest fall, how much letting go of the jump cuts a rise, and steering and braking in a fall off an edge. Each has limits (`MOVEMENT_TUNING_LIMITS`); the handler takes a partial tuning and keeps each number that is a finite number within its limits, ignoring the rest (rule 11).
- The slice carries across levels, so a death or the next level keeps what was tuned, and goes back to `current` when the game starts over, like every other slice. Being sim state, it is in the snapshot and a restored sim goes on with it; the determinism of a recorded game holds with tuning commands in it.
- Presets are data: `MOVEMENT_PRESETS` has `current` and `ninetiesPlatformer`. A preset is not a mode of the sim; the panel sends its numbers like any knob.
- `'player/jump'` now also marks the jump as held, and `'player/letGoOfJump'` as let go. While he rises from a jump that is let go of, his upward speed loses `letGoCut` of itself, once a jump, from the tick after he took off: a tap is the shortest hop, not no jump. `current` has a `letGoCut` of 0, so letting go changes nothing there. The client sends it when the last key that was jumping goes up (`input/playerCommands.ts`).
- With every number at `current`, each piece of arithmetic is the one it replaced with the same operands, so every existing test, level tests included, passes unchanged: a game nobody tunes plays exactly as before.
- The panel (`client/src/movementPanel.ts`) uses lil-gui, imported only in a dev build. It shows the numbers it has chosen and sends them again whenever the sim has others (the game started over, or `loadLevel` made a new sim): like a held key, the client asks and the sim decides. It keeps what was chosen in `localStorage` for the next reload, read as outside input and checked against the same limits.

## Consequences

- Tuning that is tried can be kept: the panel copies its numbers as JSON, which a follow-up ticket puts into `PLAYER` (or makes a preset the default) with the level tests that must then change. The higher jump of `ninetiesPlatformer` crosses the gaps of levels 2 and 3 on foot, so adopting it is a ticket about the levels too.
- A production build still has the two commands in its sim. Nothing in it sends `'player/tuneMovement'`; `'player/letGoOfJump'` is sent and, with `current`, does nothing.
- A future number of how he moves that should be tried live goes into `MovementTuning`, its limits, both presets and the panel's knobs, not into `PLAYER`. Numbers nobody needs to try live stay in `PLAYER`.
- The view's pose of him is sized for the current jump (`BODY.speedOfFullRise` in `render/stickMan.ts`); a faster jump saturates it, which is a view detail for whoever adopts a new jump.
