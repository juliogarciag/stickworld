import { Sim, type SimHandle } from '../../core/sim';
import { findCraftableRecipe, findRecipeToSwitchTo, getKnownRecipes } from './index';

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
  /**
   * The recipe that using the held item would make instead once its use is switched, or null when
   * the stick man knows no second recipe made from that item.
   */
  readonly couldMakeInstead: RecipeView | null;
}

export function getCrafting(handle: SimHandle): CraftingView {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  const canMake = findCraftableRecipe(handle);
  const other = findRecipeToSwitchTo(handle);
  return {
    knownRecipes: getKnownRecipes(handle).map((recipe) => ({
      defId: recipe.id,
      name: recipe.name,
    })),
    canMake: canMake ? { defId: canMake.id, name: canMake.name } : null,
    couldMakeInstead: other ? { defId: other.id, name: other.name } : null,
  };
}
