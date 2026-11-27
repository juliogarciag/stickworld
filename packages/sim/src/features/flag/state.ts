import { defineSlice } from '../../core/slice';

export interface FlagState {
  /** The tick the stick man reached the level's flag, which finished the level; null until he does. */
  reachedAtTick: number | null;
}

export const flagSlice = defineSlice<FlagState>('flag', () => ({ reachedAtTick: null }), { isCarriedAcrossLevels: false });
