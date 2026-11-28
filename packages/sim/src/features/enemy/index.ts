import type { Feature } from '../../core/feature';
import { keepPlayerOutOfBox } from '../player/body';
import { getFloorHeightAt } from '../player/floor';
import { updateClubEnemy } from './clubEnemy';
import { findClubEnemyDef } from './clubEnemy/defs';
import { findEnemyDef } from './defs';
import { getEnemyBox } from './guard';
import { enemiesSlice, type EnemyState } from './state';

/**
 * The enemies of a level (`enemies` in its data), the first things in the game
 * that act by themselves. This file is what every enemy has in common: it is
 * put at its post when the level starts, and its body is solid, so the stick
 * man is kept out of it and gets past by jumping over. What an enemy does
 * with its tick is its kind's (`clubEnemy/`, the only kind so far): a new
 * kind is a folder next to it and a line in `update` here.
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
      });
    }
    sim.setStateOf(enemiesSlice, placed);
  },

  update(sim) {
    for (const enemy of sim.getStateOf(enemiesSlice)) {
      const def = findEnemyDef(enemy.defId);
      if (!def) {
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
  },
};
