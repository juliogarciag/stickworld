import { defineSlice } from '../../core/slice';

/**
 * What an enemy is doing: `waiting` where it is, `approaching` the stick man it sees, `windingUp`
 * with its club going back, `swinging` it over the top and down, `recovering` while it lifts the
 * club again.
 */
export type EnemyAction = 'waiting' | 'approaching' | 'windingUp' | 'swinging' | 'recovering';

export interface EnemyState {
  /** Which kind of enemy it is: an id of `enemyDefs`. */
  defId: number;
  /** The middle of its underside, in metres: it floats, so `y` is above the floor line. */
  x: number;
  y: number;
  /** 1 when it looks right, -1 when it looks left. */
  facing: 1 | -1;
  action: EnemyAction;
  /** Ticks since it began what it is doing. */
  ticksInAction: number;
  /** The x the level put it at: the middle of the stretch it guards. */
  postX: number;
}

/**
 * Every enemy of the level, in the order the level lists them. The feature's `init` puts them
 * where the level says, so a level that starts again has every enemy back at its post.
 */
export const enemiesSlice = defineSlice<EnemyState[]>('enemies', () => [], {
  isCarriedAcrossLevels: false,
});
