import { doesBlowTouchBox, type Blow } from '../../core/blow';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { keepPlayerOutOfBox } from '../player/body';
import { getFloorHeightAt } from '../player/floor';
import { updateClubEnemy } from './clubEnemy';
import { findClubEnemyDef } from './clubEnemy/defs';
import { ENEMY, findEnemyDef } from './defs';
import { getEnemyBox } from './guard';
import { enemiesSlice, type EnemyState } from './state';

/**
 * The enemies of a level (`enemies` in its data), the first things in the game
 * that act by themselves. This file is what every enemy has in common: it is
 * put at its post when the level starts, and its body is solid, so the stick
 * man is kept out of it and gets past by jumping over. What an enemy does
 * with its tick is its kind's (`clubEnemy/`, the only kind so far): a new
 * kind is a folder next to it and a line in `update` here. An enemy that is
 * struck (`strikeEnemiesWith`) is rubbed out: it stops where it is, is no
 * longer solid and hurts nobody, and a moment later it is gone.
 */
export const enemyFeature: Feature = {
  name: 'enemy',
  slices: [enemiesSlice],

  init(sim) {
    const { floor, enemies, start } = sim.levelDef;
    const placed: EnemyState[] = [];
    for (const placement of enemies ?? []) {
      const def = findEnemyDef(placement.defId);
      if (!def) {
        continue;
      }
      const floorHeight = getFloorHeightAt(floor, placement.position.x) ?? placement.position.y;
      placed.push({
        defId: def.id,
        x: placement.position.x,
        y: floorHeight - def.floatHeight,
        // It looks the way the stick man will come from.
        facing: placement.position.x < start.x ? 1 : -1,
        action: 'waiting',
        ticksInAction: 0,
        postX: placement.position.x,
        ticksSinceStruck: null,
      });
    }
    sim.setStateOf(enemiesSlice, placed);
  },

  update(sim) {
    const rubOutTicks = Math.round(ENEMY.rubOutSeconds / sim.dt);
    for (const enemy of sim.getStateOf(enemiesSlice)) {
      const def = findEnemyDef(enemy.defId);
      if (!def) {
        continue;
      }
      // Being rubbed out, it neither stands in the way nor does anything.
      if (enemy.ticksSinceStruck !== null) {
        enemy.ticksSinceStruck += 1;
        continue;
      }
      // The stick man has moved this tick already: it is put back outside the body it walked or
      // fell into before the enemy looks for it.
      keepPlayerOutOfBox(sim, getEnemyBox(enemy, def));
      const clubEnemyDef = findClubEnemyDef(enemy.defId);
      if (clubEnemyDef) {
        updateClubEnemy(sim, enemy, clubEnemyDef);
      }
    }
    const isRubbedOut = (enemy: EnemyState): boolean =>
      enemy.ticksSinceStruck !== null && enemy.ticksSinceStruck >= rubOutTicks;
    const enemies = sim.getStateOf(enemiesSlice);
    if (enemies.some(isRubbedOut)) {
      sim.setStateOf(
        enemiesSlice,
        enemies.filter((enemy) => !isRubbedOut(enemy)),
      );
    }
  },
};

/**
 * Something strikes at the enemies: the one way anything hurts one (ADR 0008). `blow` is where the
 * weapon is this instant; every enemy it touches begins to be rubbed out, whatever it was doing,
 * its swing included. True when it struck at least one. An enemy that is being rubbed out already
 * is not struck again.
 */
export function strikeEnemiesWith(sim: Sim, blow: Blow): boolean {
  let hasStruck = false;
  for (const enemy of sim.getStateOf(enemiesSlice)) {
    const def = findEnemyDef(enemy.defId);
    const isStruckNow =
      def !== undefined &&
      enemy.ticksSinceStruck === null &&
      doesBlowTouchBox(blow, getEnemyBox(enemy, def));
    if (isStruckNow) {
      enemy.ticksSinceStruck = 0;
      hasStruck = true;
    }
  }
  return hasStruck;
}
