# 0007 - A feature's state is its own, every slice says whether it carries, and a level starts between two ticks

Status: accepted. Date: 2026-11-26.

## Context

Issues #37, #38 and #39 came out of the owner being asked how the game works underneath, after merging most of it without reading it. Three things could not be told from a diff, and so had never been seen:

- The `airplane` feature imported the player's slice and assigned eleven of its fields (seating him, moving him, standing him up, his hands). AGENTS.md documented one of them. A line that changed another feature's state looked like any other line.
- `defineSlice` defaulted `carriesAcrossLevels` to `false`, so the declaration of new state said nothing about what a death does to it unless it was one of the four that carry.
- AGENTS.md rule 3 said a level restarts by loading a snapshot back. It never did: `player`, `airplane` and `flag` called `sim.startLevel` from inside their `update`, and `game` called `sim.startOver` from `handleCommand`. The features later in `features/index.ts` then ran the rest of that tick on a level that had only just begun, while the earlier ones had run on the old one. Nothing was known to be wrong because of it; it held by where each feature sat in the list.

## Decision

**No feature imports another feature's `state.ts`; every slice states whether it carries across levels; and a feature asks for a level to start, which the sim does once the tick's updates are done.**

- What one feature reads of another or does to it is a named function in the other's folder. For the stick man that is `features/player/body.ts`: `whereHeIs` (read-only), `seatHim`, `moveHimWithHisSeat`, `standHimUp`, `startCarrying`, `stopCarrying`. For the flag it is `tickFlagWasReached`. The inventory already had `held.ts` and `give.ts`. Lint (`no-restricted-imports` on `../*/state` under `features/`) rejects the import, tests included, so a new write to another feature's state shows up in a diff as a new export in that feature's folder.
- `whereHeIs` returns his live state behind a read-only type, not a copy: a copy every call would cost every feature every tick, and the type is what stops a write. A cast gets past it, as a cast gets past anything; reviews still check.
- `defineSlice` takes `{ carriesAcrossLevels: true | false }` with no default. A required boolean was chosen over two named values because the name was already in the code, the tests and AGENTS.md, and reads as a sentence at the call.
- `sim.startLevelAfterThisTick(id)` and `sim.startOverAfterThisTick()` record what was asked; `step` starts it after the last feature's `update` and before the tick count goes up, so the level has changed by the time `step` returns, as before. Of several asks in one tick, starting over wins, then a level other than the one being played, then the level being played again; of two other levels the first is kept. What was asked is never held between two ticks, so it is not game state and not in the snapshot.
- `startLevel` and `startOver` stay, for setting a sim up between two ticks, and throw when called inside one. That is a mistake in a feature, like reading a slice that was never registered, not bad input, so rule 11 (handlers never throw on what a player sends) is untouched.
- Rule 3 now says what a snapshot is for (tests that start mid-level, the page turn) and that a restart is a level started again.

## Consequences

- The game plays the same. With every feature seeing the old level until the tick ends, the features after `player` no longer get one `update` on the fresh level in the tick he dies; none of them did anything on a level's first tick that they do not also do on its second, and recorded games on all three levels, deaths and a lost flight included, end in the same state tick for tick as on the commit before (the ticket's verification compares them).
- A feature that needs something of another feature's state has to add a function to that feature's folder, which is one more file touched than importing the slice. That is the point: it is the line a reviewer needs to see.
- Feature order still matters for everything else a feature does within a tick (the airplane reads where he is after the player has moved him). Only the start of a level no longer depends on it.
- Tests set a sim up with `startLevel` between steps as before. A test that wants another feature's state in a particular shape goes through that feature's functions or builds a snapshot.
