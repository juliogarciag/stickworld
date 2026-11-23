import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { replaceSelectedItem, selectedItemOf } from '../inventory/held';
import { recipeDef, type RecipeDef } from './defs';
import { knownRecipesSlice } from './state';

/**
 * Making one item out of another. Using an item that a recipe he knows is
 * made from makes it: the item turns into another in the same slot, with one
 * press. Recipes are learned (`teachRecipe`), which a letter does; an item he
 * knows no recipe for has no use here.
 */
export const craftingFeature: Feature = {
  name: 'crafting',
  slices: [knownRecipesSlice],
};

/** He knows the recipe `recipeDefId` from now on. Nothing changes for one he knows already, or for an id that is not a recipe's. */
export function teachRecipe(sim: Sim, recipeDefId: number): void {
  const known = sim.stateOf(knownRecipesSlice);
  if (recipeDef(recipeDefId) && !known.includes(recipeDefId)) known.push(recipeDefId);
}

/** The recipes he knows, in the order he learned them. */
export function knownRecipes(sim: Sim): RecipeDef[] {
  return sim.stateOf(knownRecipesSlice).flatMap((id) => recipeDef(id) ?? []);
}

/**
 * The recipe that using the held item would make, or undefined when he knows none made from it. No two recipes are
 * made from the same item yet (a test holds that): the first that are need a list to choose from, with a way to
 * move through it.
 */
export function recipeHeCanMake(sim: Sim): RecipeDef | undefined {
  const held = selectedItemOf(sim);
  return held === null ? undefined : knownRecipes(sim).find((known) => known.madeFrom === held);
}

/** What using the held item does for crafting, for `features/item`: it makes the recipe he knows for it. Undefined when he knows none. */
export function craftingUse(sim: Sim) {
  const recipe = recipeHeCanMake(sim);
  if (!recipe) return undefined;
  return { means: 'craft' as const, perform: () => void replaceSelectedItem(sim, recipe.makes) };
}
