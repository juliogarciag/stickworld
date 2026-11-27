import type { Note } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { notesSlice } from './state';

/**
 * A note on the level's sheet as a view needs it: what the level's data says about it, and whether
 * it is still there.
 */
export interface NoteView extends Note {
  /** How long ago it was rubbed out, in seconds, or null while it is still there. */
  readonly rubbedOutFor: number | null;
}

/** Every note of the level being played, in the order the level lists them. */
export function getNotes(handle: SimHandle): NoteView[] {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  const { rubbedOutAtTick } = handle.getStateOf(notesSlice);
  return (handle.levelDef.notes ?? []).map((note, index) => {
    const rubbedOutAt = rubbedOutAtTick[index] ?? null;
    return {
      ...note,
      rubbedOutFor: rubbedOutAt === null ? null : (handle.tick - rubbedOutAt) * handle.dt,
    };
  });
}
