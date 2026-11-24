import { defineSlice } from '../../core/slice';

export interface LetterState {
  /** True while the level's letter is there: lying on the floor, or in his hands being read. False once he has read it and put it away. */
  inLevel: boolean;
  /** True while he reads it. */
  beingRead: boolean;
}

/** Whether the level's letter lies there at the start depends on whether he has read it before, so the feature's `init` decides it. */
export const letterSlice = defineSlice<LetterState>('letter', () => ({ inLevel: false, beingRead: false }));

/** The def ids of the letters he has read. What he has read he remembers across levels and deaths. */
export const lettersReadSlice = defineSlice<number[]>('lettersRead', () => [], { carriesAcrossLevels: true });

/** The item a letter gave, given again from the sky to him who has lost it and everything he made of it. */
export interface FallenItemState {
  /** True while it is there: on its way down, or lying on the floor. */
  inLevel: boolean;
  /** Where it lies, or will lie once it has come down, in metres: where he stood when it started to fall. Only read while it is there. */
  x: number;
  y: number;
  /** How far above where it will lie it is, in metres. 0 once it lies on the floor. */
  height: number;
  /** Ticks left before one starts to fall, or null when none is on its way. */
  ticksUntilItFalls: number | null;
}

export const fallenItemSlice = defineSlice<FallenItemState>('fallenItem', () => ({ inLevel: false, x: 0, y: 0, height: 0, ticksUntilItFalls: null }));
