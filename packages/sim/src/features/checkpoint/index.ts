import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { beginHimAt, getWhereHeIs } from '../player/body';
import { checkpointSlice } from './state';

/**
 * A level's checkpoint (`getCheckpoint` in the level's data): a mark part of the
 * way through. Once he has stood on the floor at or past it, the level starts
 * him there instead of at its start whenever it starts again: after a fall,
 * after a lost flight. The next level and a game started over know nothing
 * of it. It changes nothing else about a restart.
 */
export const checkpointFeature: Feature = {
  name: 'checkpoint',
  slices: [checkpointSlice],

  init(sim) {
    const state = sim.getStateOf(checkpointSlice);
    const { checkpoint: at } = sim.levelDef;
    // A level starting keeps this slice, so that a death does. That also keeps it when another level starts: what was
    // passed on any level but this one is forgotten here.
    if (state.passedOnLevel !== sim.level || !at) state.passedOnLevel = null;
    else beginHimAt(sim, at);
  },

  update(sim) {
    const { checkpoint: at } = sim.levelDef;
    if (!at || hasPassedCheckpoint(sim)) return;
    const { x, onFloor } = getWhereHeIs(sim);
    // On his feet: flying over it in the airplane, or jumping over it, is not standing past it.
    if (onFloor && x >= at.x) sim.getStateOf(checkpointSlice).passedOnLevel = sim.level;
  },
};

/** True once he has stood past the checkpoint of the level being played. False on a level without one. */
export function hasPassedCheckpoint(sim: Sim): boolean {
  return sim.getStateOf(checkpointSlice).passedOnLevel === sim.level;
}
