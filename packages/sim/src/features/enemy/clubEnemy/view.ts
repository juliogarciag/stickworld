import type { Point } from '../../../content/levels/types';
import type { Sim } from '../../../core/sim';
import type { EnemyState } from '../state';
import type { EnemyBaseView } from '../view';
import type { ClubEnemyAction, ClubEnemyDef } from './defs';
import { getClub, getClubEnemyProgress } from './index';

/** A club enemy as a view needs it: what every enemy has, what it is doing, and its club. */
export interface ClubEnemyView extends EnemyBaseView {
  readonly kind: 'clubEnemy';
  /**
   * `waiting` where it is, `approaching` the stick man it sees, `windingUp` with its club going
   * back, `swinging` it over the top and down, which is the only time the club hurts, or
   * `recovering` while it lifts the club again.
   */
  readonly action: ClubEnemyAction;
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
}

/** The view of `seen.enemy`, a club enemy, given what every enemy's view has (`seen.base`). */
export function getClubEnemyView(
  sim: Sim,
  seen: { enemy: EnemyState; def: ClubEnemyDef; base: EnemyBaseView },
): ClubEnemyView {
  const progress = getClubEnemyProgress(sim, seen.enemy, seen.def);
  const club = getClub(seen.enemy, seen.def, progress);
  return {
    ...seen.base,
    kind: 'clubEnemy',
    action: seen.enemy.action,
    progress,
    club: {
      shoulder: club.shoulder,
      grip: club.grip,
      tip: club.tip,
      thickness: seen.def.club.thickness,
    },
  };
}
