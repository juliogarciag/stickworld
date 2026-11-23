import { defineSlice } from '../../core/slice';

export interface LetterState {
  /** True while the level's letter is there: lying on the floor, on its way down, or in his hands being read. False once he has read it and put it away. */
  inLevel: boolean;
  /** How far above where it lies it is, in metres. 0 once it lies on the floor. */
  height: number;
  /** True while he reads it. */
  beingRead: boolean;
  /** Ticks left before a new letter starts to fall, or null when none is on its way. */
  ticksUntilNewOneFalls: number | null;
}

/** Whether the level's letter lies there at the start depends on whether he has read it before, so the feature's `init` decides it. */
export const letterSlice = defineSlice<LetterState>('letter', () => ({ inLevel: false, height: 0, beingRead: false, ticksUntilNewOneFalls: null }));

/** The def ids of the letters he has read. What he has read he remembers across levels and deaths. */
export const lettersReadSlice = defineSlice<number[]>('lettersRead', () => [], { carriesAcrossLevels: true });
