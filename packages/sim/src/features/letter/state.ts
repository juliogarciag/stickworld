import { defineSlice } from '../../core/slice';

export interface LetterState {
  /** How far above where it lies the level's letter is, in metres. 0 while it lies on the floor or is in his hands. */
  height: number;
  /** True while he reads it. */
  beingRead: boolean;
  /** True once the letter that lies there has been read. A new one that falls is not opened yet. */
  opened: boolean;
  /** Ticks left before a new letter starts to fall, or null when none is on its way. */
  ticksUntilNewOneFalls: number | null;
}

/** Whether the letter lies there opened when the level starts depends on whether he has read it before, so the feature's `init` decides it. */
export const letterSlice = defineSlice<LetterState>('letter', () => ({ height: 0, beingRead: false, opened: false, ticksUntilNewOneFalls: null }));

/** The def ids of the letters he has read. What he has read he remembers across levels and deaths. */
export const lettersReadSlice = defineSlice<number[]>('lettersRead', () => [], { carriesAcrossLevels: true });
