import { Sim, type SimHandle } from '../../core/sim';
import { knownRecipes, recipeHeCanMake } from './index';

/** A recipe as a view names it. */
export interface RecipeView {
  readonly defId: number;
  readonly name: string;
}

/** What he knows how to make, as a view shows it. */
export interface CraftingView {
  /** The recipes he knows, in the order he learned them. */
  readonly knownRecipes: readonly RecipeView[];
  /** The recipe that using the held item would make right now, or null when it would make none. */
  readonly canMake: RecipeView | null;
}

export function craftingOf(handle: SimHandle): CraftingView {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const canMake = recipeHeCanMake(handle);
  return { knownRecipes: knownRecipes(handle).map(({ id, name }) => ({ defId: id, name })), canMake: canMake ? { defId: canMake.id, name: canMake.name } : null };
}
