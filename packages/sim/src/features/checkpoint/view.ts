import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { hasPassedCheckpoint } from './index';

/** The level's checkpoint as a view needs it. */
export interface CheckpointView {
  /** Where the checkpoint stands on the floor, in metres. */
  readonly position: Point;
  /**
   * True once the stick man has stood on the floor at or past the checkpoint. From then on the
   * level restarts here.
   */
  readonly isPassed: boolean;
}

/** The checkpoint of the level being played, or undefined for a level without one. */
export function getCheckpoint(handle: SimHandle): CheckpointView | undefined {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  const position = handle.levelDef.checkpoint;
  return position && { position, isPassed: hasPassedCheckpoint(handle) };
}
