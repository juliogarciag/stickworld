import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { findClubEnemyDef } from './clubEnemy/defs';
import { getClubEnemyView, type ClubEnemyView } from './clubEnemy/view';
import { getGuardedStretch } from './guard';
import { enemiesSlice } from './state';

/**
 * What a view needs of every enemy, whatever kind it is: where it is, how big its body is and
 * which way it looks. What its face looks like is the view's business.
 */
export interface EnemyBaseView {
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
  /** The stretch of floor it guards: how far its middle goes to either side, in metres. */
  readonly guardedStretch: { readonly start: number; readonly end: number };
}

/**
 * An enemy as a view needs it: one of the kinds there are, told apart by `kind`. Only the club
 * enemy so far; a new kind adds its own view to this union.
 */
export type EnemyView = ClubEnemyView;

/** Every enemy of the level being played, in the order the level lists them. */
export function getEnemies(handle: SimHandle): EnemyView[] {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  const views: EnemyView[] = [];
  for (const enemy of handle.getStateOf(enemiesSlice)) {
    const def = findClubEnemyDef(enemy.defId);
    if (!def) {
      continue;
    }
    const base: EnemyBaseView = {
      defId: enemy.defId,
      position: { x: enemy.x, y: enemy.y },
      width: def.width,
      height: def.height,
      floatHeight: def.floatHeight,
      facing: enemy.facing,
      guardedStretch: getGuardedStretch(handle.levelDef.floor, enemy, def),
    };
    views.push(getClubEnemyView(handle, { enemy, def, base }));
  }
  return views;
}
