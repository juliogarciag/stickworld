import { ENEMY } from './defs';

/**
 * What becomes of an enemy that was struck: it is `tearing` in two, the halves fall and are
 * `lying` there for a moment, and then they are `leaving` the sheet as scraps of paper. After
 * that it is gone.
 */
export type TornAction = 'tearing' | 'lying' | 'leaving';

/** How far along being torn an enemy is: what it is at, and how much of that is done, 0 to 1. */
export interface Torn {
  readonly action: TornAction;
  readonly progress: number;
}

/** How many ticks each part of being torn lasts, in order. */
export function countTornTicks(dt: number): Readonly<Record<TornAction, number>> {
  return {
    tearing: Math.round(ENEMY.tearSeconds / dt),
    lying: Math.round(ENEMY.lieSeconds / dt),
    leaving: Math.round(ENEMY.leaveSeconds / dt),
  };
}

/** True once an enemy struck `ticksSinceStruck` ticks ago has left the sheet: it is gone. */
export function isTornAndGone(ticksSinceStruck: number, dt: number): boolean {
  const ticks = countTornTicks(dt);
  return ticksSinceStruck >= ticks.tearing + ticks.lying + ticks.leaving;
}

/** How far along being torn an enemy struck `ticksSinceStruck` ticks ago is. */
export function getTorn(ticksSinceStruck: number, dt: number): Torn {
  const ticks = countTornTicks(dt);
  if (ticksSinceStruck < ticks.tearing) {
    return { action: 'tearing', progress: ticksSinceStruck / ticks.tearing };
  }
  const ticksLying = ticksSinceStruck - ticks.tearing;
  if (ticksLying < ticks.lying) {
    return { action: 'lying', progress: ticksLying / ticks.lying };
  }
  return { action: 'leaving', progress: Math.min(1, (ticksLying - ticks.lying) / ticks.leaving) };
}
