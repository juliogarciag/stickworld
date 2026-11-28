import type { FloorSegment } from '../../content/levels/types';
import type { Box } from '../../core/blow';
import type { EnemyDef } from './defs';
import type { EnemyState } from './state';

/**
 * What every enemy has, whatever kind it is: a body the stick man cannot walk through, and a
 * stretch of floor it guards and does not leave. For this feature's own files: another feature
 * that needs something of an enemy gets a named function for it in `index.ts`.
 */

/**
 * The enemy's body: what the stick man cannot walk through, and the outline a blow at it is tested
 * against (ADR 0008).
 */
export function getEnemyBox(enemy: EnemyState, def: EnemyDef): Box {
  return {
    left: enemy.x - def.width / 2,
    right: enemy.x + def.width / 2,
    top: enemy.y - def.height,
    bottom: enemy.y,
  };
}

/** The stretch of floor the enemy guards: as far as its middle goes to either side. */
export function getGuardedStretch(
  floor: readonly FloorSegment[],
  enemy: EnemyState,
  def: EnemyDef,
): { start: number; end: number } {
  const line = floor.find(
    (segment) => segment.start.x <= enemy.postX && enemy.postX <= segment.end.x,
  );
  const lineStart = line ? line.start.x + def.width / 2 : enemy.postX;
  const lineEnd = line ? line.end.x - def.width / 2 : enemy.postX;
  return {
    start: Math.min(enemy.postX, Math.max(lineStart, enemy.postX - def.guardedStretch)),
    end: Math.max(enemy.postX, Math.min(lineEnd, enemy.postX + def.guardedStretch)),
  };
}
