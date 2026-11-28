import { defineSlice } from '../../core/slice';

export interface ThrustState {
  /**
   * Ticks since the stick man began a thrust, counting the going out and the drawing back, or null
   * while it is making none.
   */
  ticksSinceBegun: number | null;
  /** Which way the thrust goes: 1 to the right, -1 to the left. Only read during a thrust. */
  direction: 1 | -1;
}

/** The thrust under way. A level that starts again starts with none. */
export const thrustSlice = defineSlice<ThrustState>(
  'thrust',
  () => ({ ticksSinceBegun: null, direction: 1 }),
  { isCarriedAcrossLevels: false },
);
