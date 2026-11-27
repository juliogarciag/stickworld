import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { flagDef } from './defs';
import { findFlagPlacedIn, isLastLevel, getSecondsSinceFlagReached } from './index';
import { flagSlice } from './state';

/** The level's flag as a view needs it. */
export interface FlagView {
  /** Where the foot of the stick is, in metres. */
  readonly position: Point;
  /** How tall the stick is, in metres. */
  readonly height: number;
  /** True once the stick man has reached it: the level is finished. */
  readonly isReached: boolean;
  /** How long it has been all the way up its stick, in seconds. 0 until it is. */
  readonly upFor: number;
  /** How far up the stick the flag has gone since the stick man reached it, from 0 to 1. */
  readonly raised: number;
  /** True for the flag of the last level: reaching it finishes the game. */
  readonly isFinalFlag: boolean;
}

/** The flag of the level being played, or undefined when the level has none. */
export function getFlag(handle: SimHandle): FlagView | undefined {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  const placed = findFlagPlacedIn(handle.levelDef);
  if (!placed) {
    return undefined;
  }
  const reachedFor = getSecondsSinceFlagReached(handle) ?? 0;
  return {
    position: placed.position,
    height: flagDef.height,
    isReached: handle.getStateOf(flagSlice).reachedAtTick !== null,
    upFor: Math.max(0, reachedFor - flagDef.raiseSeconds),
    raised: Math.min(1, reachedFor / flagDef.raiseSeconds),
    isFinalFlag: isLastLevel(handle.levelDef),
  };
}
