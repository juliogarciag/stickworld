import { Sim, type SimHandle } from '../../core/sim';
import { knownRecipes } from './index';
import { recipeListSlice } from './state';

/** The list of recipes as a view shows it. */
export interface RecipeListView {
  /** True while he has the list out. */
  readonly open: boolean;
  /** The recipes he knows, in the order he learned them. */
  readonly recipes: readonly { readonly defId: number; readonly name: string }[];
}

export function recipeListOf(handle: SimHandle): RecipeListView {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return { open: handle.stateOf(recipeListSlice).open, recipes: knownRecipes(handle).map(({ id, name }) => ({ defId: id, name })) };
}
