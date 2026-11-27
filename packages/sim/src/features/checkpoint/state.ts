import { defineSlice } from '../../core/slice';

export interface CheckpointState {
  /** The id of the level whose checkpoint has been passed, or null when none has. */
  passedOnLevel: number | null;
}

/**
 * Carried across level starts, because a death restarts the same level and must keep the checkpoint.
 * Starting a different level must clear it, and the feature's `init` does that.
 * Starting the game over resets every slice, including this one.
 */
export const checkpointSlice = defineSlice<CheckpointState>(
  'checkpoint',
  () => ({ passedOnLevel: null }),
  { isCarriedAcrossLevels: true },
);
