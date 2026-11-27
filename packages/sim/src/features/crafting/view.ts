import { Sim, type SimHandle } from '../../core/sim';
import { getKnownRecipes, findCraftableRecipe } from './index';

/** A recipe as a view names it. */
export interface RecipeView {
  readonly defId: number;
  readonly name: string;
}

/** What the stick man knows how to make, as a view shows it. */
export interface CraftingView {
  /** The recipes the stick man knows, in the order it learned them. */
  readonly knownRecipes: readonly RecipeView[];
  /** The recipe that using the held item would make right now, or null when it would make none. */
  readonly canMake: RecipeView | null;
}

export function getCrafting(handle: SimHandle): CraftingView {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const canMake = findCraftableRecipe(handle);
  return { knownRecipes: getKnownRecipes(handle).map((recipe) => ({ defId: recipe.id, name: recipe.name })), canMake: canMake ? { defId: canMake.id, name: canMake.name } : null };
}
