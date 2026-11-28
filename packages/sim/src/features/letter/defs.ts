import type { Def } from '../../content/defs';
import { PAPER_AIRPLANE_RECIPE_ID, SPEAR_RECIPE_ID } from '../crafting/defs';
import { PAPER_ITEM_ID, PENCIL_ITEM_ID } from '../inventory/defs';

/**
 * Letters: what a level leaves on the floor for the stick man to read. Ids 300-399 are
 * this feature's block in content/defs.ts. A new letter is a new entry here,
 * placed in a level by its id.
 */
export interface LetterDef extends Def {
  /**
   * What it says: what to do, not how. It never names a key (which keys there are is the client's
   * business), and what the keys do is shown beside them as it becomes possible.
   */
  readonly text: string;
  /** The def id of the recipe that reading it teaches. */
  readonly teachesRecipe: number;
  /**
   * The def id of the item that reading it gives the stick man when the stick man has neither that
   * item nor what the recipe makes of it: in its hand, in place of what it held when it has no
   * slot free. It is also what falls from the sky, where the stick man
   * stands, for the stick man who has read it and lost both; a level that starts again for the
   * stick man gives what the recipe makes instead.
   */
  readonly gives: number;
}

/** Level 3's letter: it teaches the paper airplane. */
export const AIRPLANE_LETTER_ID = 300;

/** The letter about the spear: it teaches sharpening the pencil it gives. */
export const SPEAR_LETTER_ID = 301;

export const letterDefs: readonly LetterDef[] = [
  {
    id: AIRPLANE_LETTER_ID,
    name: 'the letter about the paper airplane',
    text: 'A sheet of paper can fly. Fold it into an airplane and carry it to the edge.',
    teachesRecipe: PAPER_AIRPLANE_RECIPE_ID,
    gives: PAPER_ITEM_ID,
  },
  {
    id: SPEAR_LETTER_ID,
    name: 'the letter about the spear',
    text: 'A pencil reaches further than a club. Sharpen it into a spear and thrust it at what stands in the way.',
    teachesRecipe: SPEAR_RECIPE_ID,
    gives: PENCIL_ITEM_ID,
  },
];

/** The letter with this id, or undefined if none has it. */
export function getLetterDef(id: number): LetterDef | undefined {
  return letterDefs.find((def) => def.id === id);
}

/**
 * How letters behave, and the item that falls from the sky in place of one the stick man has read.
 * Metres and seconds.
 */
export const LETTER = {
  /**
   * How close to it the stick man's feet have to be to read it, to go on reading, and to pick up
   * the item that fell there.
   */
  reach: 0.8,
  /**
   * How long after the stick man has lost everything it was for, and is still alive, the item
   * starts to fall.
   */
  fallsAfter: 0.6,
  /** How high above the floor it starts: above the top of the screen. */
  fallsFromHeight: 8.5,
  /** How fast it comes down. Paper: slow and steady. */
  fallSpeed: 3.6,
} as const;
