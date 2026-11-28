import type { Point } from '../../content/levels/types';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { strikeEnemiesWith } from '../enemy';
import { SPEAR_ITEM_ID } from '../inventory/defs';
import { getSelectedItem } from '../inventory/held';
import { getPlayerBody, isPlayerStruck } from '../player/body';
import { SPEAR } from './defs';
import { thrustSlice } from './state';

/**
 * The spear in the stick man's hand. Using it is a thrust: its point goes
 * straight out in front of the stick man, further than a club reaches, and
 * what it touches on the way out is struck (`strikeEnemiesWith`, ADR 0008).
 * Then the stick man draws it back, and until it has, it cannot thrust again:
 * a thrust that misses costs that time. The spear never leaves the stick
 * man's hand, so it is never lost by using it. The stick man walks and jumps
 * as it likes meanwhile; the thrust keeps the way it began.
 */
export const spearFeature: Feature = {
  name: 'spear',
  slices: [thrustSlice],

  update(sim) {
    const thrust = sim.getStateOf(thrustSlice);
    if (thrust.ticksSinceBegun === null) {
      return;
    }
    // Struck down, the stick man thrusts at nothing.
    if (isPlayerStruck(sim)) {
      thrust.ticksSinceBegun = null;
      return;
    }
    thrust.ticksSinceBegun += 1;
    const ticks = countThrustTicks(sim.dt);
    // A thrust begun goes on to its end whatever the stick man does next, a letter picked up or
    // a flag reached included. Putting the spear out of its hand only takes the point away: the
    // time the thrust costs runs on, so that nothing gets the next thrust sooner.
    const isStriking =
      thrust.ticksSinceBegun <= ticks.goingOut && getSelectedItem(sim) === SPEAR_ITEM_ID;
    if (isStriking) {
      // Only what is in front of the stick man strikes: the shaft behind its hand does not.
      const spear = getSpearLine(sim);
      strikeEnemiesWith(sim, {
        start: { x: getPlayerBody(sim).x, y: spear.tip.y },
        end: spear.tip,
        thickness: SPEAR.thickness,
        direction: thrust.direction,
      });
    }
    if (thrust.ticksSinceBegun >= ticks.goingOut + ticks.drawingBack) {
      thrust.ticksSinceBegun = null;
    }
  },
};

/**
 * What using the held item does when it is the spear, for `features/item`: the stick man thrusts
 * it the way it faces. Undefined while a thrust is under way, the drawing back included.
 */
export function getSpearUse(sim: Sim) {
  const thrust = sim.getStateOf(thrustSlice);
  const canThrust = getSelectedItem(sim) === SPEAR_ITEM_ID && thrust.ticksSinceBegun === null;
  if (!canThrust) {
    return undefined;
  }
  return {
    means: 'thrust' as const,
    perform: () => {
      thrust.ticksSinceBegun = 0;
      thrust.direction = getPlayerBody(sim).facing;
    },
  };
}

/** What the stick man is doing with the spear: nothing, thrusting it out, or drawing it back. */
export type SpearAction = 'ready' | 'thrusting' | 'recovering';

/**
 * What the stick man is doing with the spear right now and how far along, from 0 to 1. 0 while it
 * is ready.
 */
export function getThrustProgress(sim: Sim): { action: SpearAction; progress: number } {
  const { ticksSinceBegun } = sim.getStateOf(thrustSlice);
  const ticks = countThrustTicks(sim.dt);
  if (ticksSinceBegun === null) {
    return { action: 'ready', progress: 0 };
  }
  if (ticksSinceBegun < ticks.goingOut) {
    return { action: 'thrusting', progress: ticksSinceBegun / ticks.goingOut };
  }
  return {
    action: 'recovering',
    progress: Math.min(1, (ticksSinceBegun - ticks.goingOut) / ticks.drawingBack),
  };
}

/**
 * Where the spear is in a thrust: level, at the height of the stick man's chest, its point as far
 * out as the thrust has taken it and coming back as it is drawn back. Ready, where a thrust would
 * begin, the way the stick man faces.
 */
export function getSpearLine(sim: Sim): { butt: Point; tip: Point; direction: 1 | -1 } {
  const player = getPlayerBody(sim);
  const thrust = sim.getStateOf(thrustSlice);
  const { action, progress } = getThrustProgress(sim);
  const direction = action === 'ready' ? player.facing : thrust.direction;
  const reachGained = (SPEAR.reach - SPEAR.reachDrawnBack) * getShareOut(action, progress);
  const tip = {
    x: player.x + direction * (SPEAR.reachDrawnBack + reachGained),
    y: player.y - SPEAR.thrustHeight,
  };
  return { butt: { x: tip.x - direction * SPEAR.length, y: tip.y }, tip, direction };
}

// ---- Helpers ----

/** How many ticks the point takes to go out, and the spear to be drawn back. */
function countThrustTicks(dt: number): { goingOut: number; drawingBack: number } {
  return {
    goingOut: Math.round(SPEAR.thrustSeconds / dt),
    drawingBack: Math.round(SPEAR.recoverSeconds / dt),
  };
}

/** How much of the way out the point is, from 0, drawn back, to 1. */
function getShareOut(action: SpearAction, progress: number): number {
  if (action === 'thrusting') {
    return progress;
  }
  if (action === 'recovering') {
    return 1 - progress;
  }
  return 0;
}
