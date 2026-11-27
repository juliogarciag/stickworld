import { defineSlice } from '../../core/slice';

export interface CheckpointState {
  /** The id of the level whose checkpoint the stick man has stood past, or null while it has passed none. */
  passedOnLevel: number | null;
}

/**
 * Carried, because a death must not forget it: a restart is the same level started again. What must forget it, the
 * next level, is done by the feature's `init`, which drops a checkpoint passed on any level but the one that starts.
 * Starting over resets every slice, this one too.
 */
export const checkpointSlice = defineSlice<CheckpointState>('checkpoint', () => ({ passedOnLevel: null }), { isCarriedAcrossLevels: true });
