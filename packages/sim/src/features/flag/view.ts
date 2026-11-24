import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { flagDef } from './defs';
import { flagPlacedIn, isTheLastLevel, secondsSinceFlagReached } from './index';
import { flagSlice } from './state';

/** The level's flag as a view needs it. */
export interface FlagView {
  /** Where the foot of the stick is, in metres. */
  readonly at: Point;
  /** How tall the stick is, in metres. */
  readonly height: number;
  /** True once the stick man has reached it: the level is finished. */
  readonly reached: boolean;
  /** How long ago he reached it, in seconds. 0 until he does. */
  readonly reachedFor: number;
  /** How far up the stick the flag has gone since he reached it, from 0 to 1. */
  readonly raised: number;
  /** True for the flag of the last level: reaching it finishes the game. */
  readonly endsTheGame: boolean;
}

/** The flag of the level being played, or undefined when the level has none. */
export function flagOf(handle: SimHandle): FlagView | undefined {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const placed = flagPlacedIn(handle.levelDef);
  if (!placed) return undefined;
  const reachedFor = secondsSinceFlagReached(handle) ?? 0;
  return { at: placed.at, height: flagDef.height, reached: handle.stateOf(flagSlice).reachedAtTick !== null, reachedFor, raised: Math.min(1, reachedFor / flagDef.raiseSeconds), endsTheGame: isTheLastLevel(handle.levelDef) };
}
