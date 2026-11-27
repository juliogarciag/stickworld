import type { Command } from './commands';
import type { Sim } from './sim';
import type { StateSlice } from './slice';

/**
 * A feature is a self-contained slice of game logic living in
 * features/<name>/. When a level starts the sim gives every slice its
 * initial value, then calls `init`. Every tick it calls, in this order:
 *
 *   handleCommand (per feature, per command) -> update (per feature)
 *
 * A level a feature asks for (`sim.startLevelAfterThisTick`) starts after the
 * last `update` of that tick, so every feature sees the tick out on the
 * level as it was.
 *
 * Features keep all their state in their slices (`sim.stateOf(slice)`).
 * Never keep game state in closures or module variables: the snapshot would
 * miss it and a restored level would differ from the one that was saved.
 */
export interface Feature {
  readonly name: string;
  /** The slices of state this feature owns. The sim creates and snapshots them. */
  readonly slices?: readonly StateSlice<unknown>[];
  /** Called when a level starts, after every slice holds its initial value. Not called when a snapshot is restored. It sets up this feature's own state and cannot start a level or ask for one. */
  init?(sim: Sim): void;
  /** Called for every command of the tick. Ignore commands you do not own; validate every field; never throw. */
  handleCommand?(sim: Sim, command: Command): void;
  /** One tick of this feature's rules. */
  update?(sim: Sim): void;
}
