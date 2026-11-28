import { defineSlice } from '../../core/slice';
import type { ClubEnemyAction } from './clubEnemy/defs';

/**
 * What an enemy is doing. Each kind has its own things to do; every kind starts a level `waiting`.
 */
export type EnemyAction = ClubEnemyAction;

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
