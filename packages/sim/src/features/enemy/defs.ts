import type { Def } from '../../content/defs';
import { clubEnemyDef } from './clubEnemy/defs';

/**
 * The enemies: things that guard a stretch of floor and hurt the stick man. Ids 500-599 are this
 * feature's block in content/defs.ts. This file has what every kind of enemy has; a kind has a
 * folder of its own next to it (`clubEnemy/`) with its def, its rules and its part of the view,
 * and adds its def to `enemyDefs`.
 *
 * Metres and seconds. Change a number, never the logic.
 */
export interface EnemyDef extends Def {
  /** How wide its body is, in metres. The stick man cannot walk through it. */
  readonly width: number;
  /** How tall its body is, in metres: low enough for the stick man's jump to clear. */
  readonly height: number;
  /** How far above the floor line its underside floats, in metres. */
  readonly floatHeight: number;
  /** How far to either side it sees the stick man, in metres from its middle. */
  readonly sightDistance: number;
  /**
   * How far above or below its underside the stick man's feet may be for it to see the stick man,
   * in metres: more than a jump, less than a fall down a gap or a flight high overhead.
   */
  readonly sightHeight: number;
  /** How fast it moves along the floor towards the stick man, in metres per second. */
  readonly speed: number;
  /**
   * How far to either side of where the level put it it goes, in metres: the stretch it guards.
   * It never leaves it, and never leaves its floor line.
   */
  readonly guardedStretch: number;
}

export const enemyDefs: readonly EnemyDef[] = [clubEnemyDef];

/** The enemy def with this id, or undefined when `defId` is not an enemy's. */
export function findEnemyDef(defId: number): EnemyDef | undefined {
  return enemyDefs.find((def) => def.id === defId);
}
