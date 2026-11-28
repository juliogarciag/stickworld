import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { findEnemyDef } from './defs';
import { getClub, getGuardedStretch, getProgress } from './index';
import { enemiesSlice, type EnemyAction } from './state';

/**
 * An enemy as a view needs it: where it is, what it is doing and how far along, and where its club
 * is. What its face looks like is the view's business.
 */
export interface EnemyView {
  /** Which kind of enemy it is: the id of its def. */
  readonly defId: number;
  /** The middle of its underside, in metres. It floats: this is above the floor line. */
  readonly position: Point;
  /** How wide and how tall its body is, in metres: what the stick man cannot walk through. */
  readonly width: number;
  readonly height: number;
  /** How far above the floor line its underside is, in metres. */
  readonly floatHeight: number;
  /** 1 when it looks right, -1 when it looks left. */
  readonly facing: 1 | -1;
  /**
   * `waiting` where it is, `approaching` the stick man it sees, `windingUp` with its club going
   * back, `swinging` it over the top and down, which is the only time the club hurts, or
   * `recovering` while it lifts the club again.
   */
  readonly action: EnemyAction;
  /** How far along a wind-up, a swing or a recovery it is, from 0 to 1. 0 otherwise. */
  readonly progress: number;
  /**
   * Its arm and club right now, as the sim tests them: from `shoulder` to `grip` is its arm, from
   * `grip` to `tip` the club, `thickness` across.
   */
  readonly club: {
    readonly shoulder: Point;
    readonly grip: Point;
    readonly tip: Point;
    readonly thickness: number;
  };
  /** The stretch of floor it guards: how far its middle goes to either side, in metres. */
  readonly guardedStretch: { readonly start: number; readonly end: number };
}

/** Every enemy of the level being played, in the order the level lists them. */
export function getEnemies(handle: SimHandle): EnemyView[] {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  const views: EnemyView[] = [];
  for (const enemy of handle.getStateOf(enemiesSlice)) {
    const def = findEnemyDef(enemy.defId);
    if (!def) {
      continue;
    }
    const progress = getProgress(handle, enemy, def);
    const club = getClub(enemy, def, progress);
    views.push({
      defId: enemy.defId,
      position: { x: enemy.x, y: enemy.y },
      width: def.width,
      height: def.height,
      floatHeight: def.floatHeight,
      facing: enemy.facing,
      action: enemy.action,
      progress,
      club: {
        shoulder: club.shoulder,
        grip: club.grip,
        tip: club.tip,
        thickness: def.club.thickness,
      },
      guardedStretch: getGuardedStretch(handle.levelDef.floor, enemy, def),
    });
  }
  return views;
}
