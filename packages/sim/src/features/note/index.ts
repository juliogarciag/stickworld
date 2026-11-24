import type { Feature } from '../../core/feature';
import { playerSlice } from '../player/state';
import { notesSlice } from './state';

/**
 * The notes a level has written on its sheet (`notes` in the level's data):
 * what to do here. A note that says how far he has to get (`rubbedOutPast`)
 * is rubbed out once he stands on the floor past it, and is there again when
 * the level starts again. What a note looks like is the view's.
 */
export const noteFeature: Feature = {
  name: 'note',
  slices: [notesSlice],

  update(sim) {
    const { rubbedOutAtTick } = sim.stateOf(notesSlice);
    const { x, onFloor } = sim.stateOf(playerSlice);
    (sim.levelDef.notes ?? []).forEach(({ rubbedOutPast }, index) => {
      const hasDoneIt = rubbedOutPast !== undefined && onFloor && x > rubbedOutPast;
      if (hasDoneIt && rubbedOutAtTick[index] === null) rubbedOutAtTick[index] = sim.tick;
    });
  },
};
