import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { getPlayerBody, startPlayerAt } from '../player/body';
import { checkpointSlice } from './state';

/**
 * A level's checkpoint (`checkpoint` in the level's data): a mark part of the way through the level.
 * The stick man passes the checkpoint by standing on the floor at or past the mark. From then on,
 * every restart of the level (after a fall, after a lost flight) begins at the checkpoint instead of
 * at the level's start. Nothing else about a restart changes. Starting another level or starting
 * the game over forgets the checkpoint.
 */
export const checkpointFeature: Feature = {
  name: 'checkpoint',
  slices: [checkpointSlice],

  init(sim) {
    const state = sim.getStateOf(checkpointSlice);
    const checkpointPosition = sim.levelDef.checkpoint;
    // The slice survives every level start, so that a death keeps the checkpoint. It also survives the start of a
    // different level, so a checkpoint passed on another level is cleared here.
    if (state.passedOnLevel !== sim.level || !checkpointPosition) state.passedOnLevel = null;
    else startPlayerAt(sim, checkpointPosition);
  },

  update(sim) {
    const checkpointPosition = sim.levelDef.checkpoint;
    if (!checkpointPosition || hasPassedCheckpoint(sim)) return;
    const player = getPlayerBody(sim);
    // Only standing on the floor counts: flying or jumping over the checkpoint does not pass it.
    if (player.isOnFloor && player.x >= checkpointPosition.x) sim.getStateOf(checkpointSlice).passedOnLevel = sim.level;
  },
};

/** True once the stick man has stood on the floor at or past the current level's checkpoint. False on a level without one. */
export function hasPassedCheckpoint(sim: Sim): boolean {
  return sim.getStateOf(checkpointSlice).passedOnLevel === sim.level;
}
