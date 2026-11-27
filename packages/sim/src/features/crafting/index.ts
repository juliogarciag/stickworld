import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { replaceSelectedItem, getSelectedItem } from '../inventory/held';
import { getRecipeDef, type RecipeDef } from './defs';
import { knownRecipesSlice } from './state';

/**
 * Making one item out of another. Using an item that a recipe the stick man knows is
 * made from makes it: the item turns into another in the same slot, with one
 * press. Recipes are learned (`teachRecipe`), which a letter does; an item the stick man
 * knows no recipe for has no use here.
 */
export const craftingFeature: Feature = {
  name: 'crafting',
  slices: [knownRecipesSlice],
};

/** The stick man knows the recipe `recipeDefId` from now on. Nothing changes for one the stick man knows already, or for an id that is not a recipe's. */
export function teachRecipe(sim: Sim, recipeDefId: number): void {
  const known = sim.getStateOf(knownRecipesSlice);
  if (getRecipeDef(recipeDefId) && !known.includes(recipeDefId)) {
    known.push(recipeDefId);
  }
}

/** The recipes the stick man knows, in the order it learned them. */
export function getKnownRecipes(sim: Sim): RecipeDef[] {
  return sim.getStateOf(knownRecipesSlice).flatMap((id) => getRecipeDef(id) ?? []);
}

/**
 * The recipe that using the held item would make, or undefined when the stick man knows none made from it. No two recipes are
 * made from the same item yet (a test holds that): the first that are need a list to choose from, with a way to
 * move through it.
 */
export function findCraftableRecipe(sim: Sim): RecipeDef | undefined {
  const held = getSelectedItem(sim);
  return held === null ? undefined : getKnownRecipes(sim).find((known) => known.madeFrom === held);
}

/** What using the held item does for crafting, for `features/item`: it makes the recipe the stick man knows for it. Undefined when the stick man knows none. */
export function getCraftingUse(sim: Sim) {
  const recipe = findCraftableRecipe(sim);
  if (!recipe) {
    return undefined;
  }
  return { means: 'craft' as const, perform: () => void replaceSelectedItem(sim, recipe.makes) };
}
