import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { beginHimAt, whereHeIs } from '../player/body';
import { checkpointSlice } from './state';

/**
 * A level's checkpoint (`checkpoint` in the level's data): a mark part of the
 * way through. Once he has stood on the floor at or past it, the level starts
 * him there instead of at its start whenever it starts again: after a fall,
 * after a lost flight. The next level and a game started over know nothing
 * of it. It changes nothing else about a restart.
 */
export const checkpointFeature: Feature = {
  name: 'checkpoint',
  slices: [checkpointSlice],

  init(sim) {
    const checkpoint = sim.stateOf(checkpointSlice);
    const { checkpoint: at } = sim.levelDef;
    // The slice is kept whenever a level starts, so another level's checkpoint is still in it here: forget it.
    if (checkpoint.passedOnLevel !== sim.level || !at) checkpoint.passedOnLevel = null;
    else beginHimAt(sim, at);
  },

  update(sim) {
    const { checkpoint: at } = sim.levelDef;
    if (!at || hasPassedCheckpoint(sim)) return;
    const { x, onFloor } = whereHeIs(sim);
    // On his feet: flying over it in the airplane, or jumping over it, is not standing past it.
    if (onFloor && x >= at.x) sim.stateOf(checkpointSlice).passedOnLevel = sim.level;
  },
};

/** True once he has stood past the checkpoint of the level being played. False on a level without one. */
export function hasPassedCheckpoint(sim: Sim): boolean {
  return sim.stateOf(checkpointSlice).passedOnLevel === sim.level;
}
