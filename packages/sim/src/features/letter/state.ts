import { defineSlice } from '../../core/slice';

export interface LetterState {
  /** True while the level's letter is there: lying on the floor, or in the stick man's hands being read. False once the stick man has read it and put it away. */
  isInLevel: boolean;
  /** True while the stick man reads it. */
  isBeingRead: boolean;
}

/** Whether the level's letter lies there at the start depends on whether the stick man has read it before, so the feature's `init` decides it. */
export const letterSlice = defineSlice<LetterState>(
  'letter',
  () => ({ isInLevel: false, isBeingRead: false }),
  { isCarriedAcrossLevels: false },
);

/** The def ids of the letters the stick man has read. What the stick man has read it remembers across levels and deaths. */
export const lettersReadSlice = defineSlice<number[]>('lettersRead', () => [], {
  isCarriedAcrossLevels: true,
});

/** The item a letter gave, given again from the sky to the stick man who has lost it and everything the stick man made of it. */
export interface FallenItemState {
  /** True while it is there: on its way down, or lying on the floor. */
  isInLevel: boolean;
  /** Where it lies, or will lie once it has come down, in metres: where the stick man stood when it started to fall. Only read while it is there. */
  x: number;
  y: number;
  /** How far above where it will lie it is, in metres. 0 once it lies on the floor. */
  height: number;
  /** Ticks left before one starts to fall, or null when none is on its way. */
  ticksUntilFall: number | null;
}

export const fallenItemSlice = defineSlice<FallenItemState>(
  'fallenItem',
  () => ({ isInLevel: false, x: 0, y: 0, height: 0, ticksUntilFall: null }),
  { isCarriedAcrossLevels: false },
);
