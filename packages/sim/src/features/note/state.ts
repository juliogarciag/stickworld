import { defineSlice } from '../../core/slice';

export interface NotesState {
  /** For each of the level's notes, in the order the level lists them: the tick it was rubbed out on, or null while it is still there. */
  rubbedOutAtTick: (number | null)[];
}

/** Every note is there again when the level starts again: he may need it a second time. */
export const notesSlice = defineSlice<NotesState>('notes', (level) => ({ rubbedOutAtTick: (level.notes ?? []).map(() => null) }));
