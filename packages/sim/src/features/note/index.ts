import type { Feature } from '../../core/feature';
import { getPlayerBody } from '../player/body';
import { notesSlice } from './state';

/**
 * The notes a level has written on its sheet (`notes` in the level's data):
 * what to do here. A note that says how far the stick man has to get (`rubbedOutPast`)
 * is rubbed out once the stick man stands on the floor past it, and is there again when
 * the level starts again. What a note looks like is the view's.
 */
export const noteFeature: Feature = {
  name: 'note',
  slices: [notesSlice],

  update(sim) {
    const { rubbedOutAtTick } = sim.getStateOf(notesSlice);
    const { x, isOnFloor } = getPlayerBody(sim);
    (sim.levelDef.notes ?? []).forEach((note, index) => {
      const isNoteDone = note.rubbedOutPast !== undefined && isOnFloor && x > note.rubbedOutPast;
      if (isNoteDone && rubbedOutAtTick[index] === null) {
        rubbedOutAtTick[index] = sim.tick;
      }
    });
  },
};
