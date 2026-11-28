import { levels } from '../../content/levels';
import type { Level, Placement } from '../../content/levels/types';
import { STICK_MAN_HEIGHT } from '../../content/tuning';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { getPlayerBody, isPlayerStruck } from '../player/body';
import { FLAG_DEF_ID, flagDef, LEVEL_END } from './defs';
import { flagSlice } from './state';

/**
 * The flag at the end of a level. Touching it finishes the level; after a
 * short pause the next level starts, when there is one.
 */
export const flagFeature: Feature = {
  name: 'flag',
  slices: [flagSlice],

  update(sim) {
    const flag = sim.getStateOf(flagSlice);
    if (flag.reachedAtTick === null) {
      const placed = findFlagPlacedIn(sim.levelDef);
      const { x, y, isSeated } = getPlayerBody(sim);
      // A flag is reached on the stick man's own feet: flying past it in the airplane does not
      // count, and neither does being struck down next to it.
      const isOnOwnFeet = !isSeated && !isPlayerStruck(sim);
      const hasReachedFlag =
        placed !== undefined && isOnOwnFeet && isTouchingFlag({ feet: { x, y }, placed });
      if (hasReachedFlag) {
        flag.reachedAtTick = sim.tick;
      }
      return;
    }
    const nextLevel = findLevelToStartNow({
      levels,
      level: sim.level,
      ticksSinceReached: sim.tick - flag.reachedAtTick,
      dt: sim.dt,
    });
    if (nextLevel) {
      sim.startLevelAfterThisTick(nextLevel.id);
    }
  },
};

/** True for the last level there is: its flag finishes the game, and no level follows it. */
export function isLastLevel(level: Level): boolean {
  return levels[levels.length - 1]?.id === level.id;
}

/** True once the stick man has reached the level's flag: the level is finished. */
export function isFlagReached(sim: Sim): boolean {
  return sim.getStateOf(flagSlice).reachedAtTick !== null;
}

/** The tick the stick man reached the level's flag on, or null until it does. */
export function getTickFlagWasReached(sim: Sim): number | null {
  return sim.getStateOf(flagSlice).reachedAtTick;
}

/** How long ago the stick man reached the level's flag, in seconds, or undefined until it does. */
export function getSecondsSinceFlagReached(sim: Sim): number | undefined {
  const { reachedAtTick } = sim.getStateOf(flagSlice);
  return reachedAtTick === null ? undefined : (sim.tick - reachedAtTick) * sim.dt;
}

/** Where the level's flag stands, or undefined for a level without one. */
export function findFlagPlacedIn(level: Level): Placement | undefined {
  return level.placements.find((placement) => placement.defId === FLAG_DEF_ID);
}

// ---- Helpers ----

/**
 * True when the stick man is within reach of the stick and any part of the stick man is level with
 * it: the stick man cannot jump over a flag taller than its jump.
 */
function isTouchingFlag(input: { feet: { x: number; y: number }; placed: Placement }): boolean {
  const isInReach = Math.abs(input.feet.x - input.placed.position.x) <= flagDef.reach;
  const isLevelWithStick =
    input.feet.y >= input.placed.position.y - flagDef.height &&
    input.feet.y - STICK_MAN_HEIGHT <= input.placed.position.y;
  return isInReach && isLevelWithStick;
}

interface FinishedLevel {
  /** Every level, in the order they are played. */
  readonly levels: readonly Level[];
  /** The id of the finished level. */
  readonly level: number;
  readonly ticksSinceReached: number;
  readonly dt: number;
}

/**
 * The level that follows the finished one, once the pause after its flag is over; undefined during
 * the pause and after the last level.
 */
function findLevelToStartNow(finishedLevel: FinishedLevel): Level | undefined {
  if (
    finishedLevel.ticksSinceReached < Math.round(LEVEL_END.pauseBeforeNextLevel / finishedLevel.dt)
  ) {
    return undefined;
  }
  const finishedIndex = finishedLevel.levels.findIndex(
    (candidate) => candidate.id === finishedLevel.level,
  );
  return finishedIndex === -1 ? undefined : finishedLevel.levels[finishedIndex + 1];
}

export const __testing__ = { findLevelToStartNow };
