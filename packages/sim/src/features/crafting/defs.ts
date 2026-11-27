import type { Def } from '../../content/defs';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from '../inventory/defs';

/**
 * The recipes: what an item the stick man holds can be made into. Ids 400-499 are this
 * feature's block in content/defs.ts. A new recipe is a new entry here.
 */
export interface RecipeDef extends Def {
  /** The def id of the item the recipe uses up. */
  readonly madeFrom: number;
  /** The def id of the item it leaves in the same slot. */
  readonly makes: number;
}

/** The paper folded into a paper airplane. Level 3's letter teaches it. */
export const PAPER_AIRPLANE_RECIPE_ID = 400;

export const recipeDefs: readonly RecipeDef[] = [{ id: PAPER_AIRPLANE_RECIPE_ID, name: 'paper airplane', madeFrom: PAPER_ITEM_ID, makes: AIRPLANE_ITEM_ID }];

/** The recipe with this id, or undefined if none has it. */
export function getRecipeDef(id: number): RecipeDef | undefined {
  return recipeDefs.find((def) => def.id === id);
}
