import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { hasPassedCheckpoint } from './index';

/** The level's checkpoint as a view needs it. */
export interface CheckpointView {
  /** Where it stands on the floor, in metres. */
  readonly at: Point;
  /** True once he has stood past it: from then on the level starts him here. */
  readonly passed: boolean;
}

/** The checkpoint of the level being played, or undefined for a level without one. */
export function checkpointOf(handle: SimHandle): CheckpointView | undefined {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const { checkpoint: at } = handle.levelDef;
  return at && { at, passed: hasPassedCheckpoint(handle) };
}
