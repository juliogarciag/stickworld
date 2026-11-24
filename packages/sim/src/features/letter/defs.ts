import type { Def } from '../../content/defs';
import { PAPER_AIRPLANE_RECIPE_ID } from '../crafting/defs';
import { PAPER_ITEM_ID } from '../inventory/defs';

/**
 * Letters: what a level leaves on the floor for him to read. Ids 300-399 are
 * this feature's block in content/defs.ts. A new letter is a new entry here,
 * placed in a level by its id.
 */
export interface LetterDef extends Def {
  /** What it says: what to do, not how. It never names a key (which keys there are is the client's business), and what the keys do is shown beside them as it becomes possible. */
  readonly text: string;
  /** The def id of the recipe that reading it teaches. */
  readonly teachesRecipe: number;
  /** The def id of the item that reading it gives him when he has neither that item nor what the recipe makes of it. A level that starts again for him who has read it gives what the recipe makes instead. */
  readonly gives: number;
}

/** Level 3's letter: it teaches the paper airplane. */
export const AIRPLANE_LETTER_ID = 300;

export const letterDefs: readonly LetterDef[] = [
  {
    id: AIRPLANE_LETTER_ID,
    name: 'the letter about the paper airplane',
    text: 'A sheet of paper can fly. Fold it into an airplane and carry it to the edge.',
    teachesRecipe: PAPER_AIRPLANE_RECIPE_ID,
    gives: PAPER_ITEM_ID,
  },
];

/** The letter with this id, or undefined if none has it. */
export function letterDef(id: number): LetterDef | undefined {
  return letterDefs.find((def) => def.id === id);
}

/** How letters behave. Metres and seconds. */
export const LETTER = {
  /** How close to it his feet have to be to read it, and to go on reading. */
  reach: 0.8,
  /** How long after he has lost everything it was for, and is still alive, a new one starts to fall. */
  fallsAfter: 0.6,
  /** How high above the floor a new one starts: above the top of the screen. */
  fallsFromHeight: 8.5,
  /** How fast it comes down. Paper: slow and steady. */
  fallSpeed: 3.6,
} as const;
