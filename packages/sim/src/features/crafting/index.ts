import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { replaceSelectedItem, selectedItemOf } from '../inventory/held';
import { isStandingStill } from '../player';
import { recipeDef, recipeDefs, type RecipeDef } from './defs';
import { knownRecipesSlice, recipeListSlice } from './state';

/**
 * Making one item out of another. Using an item some recipe is made from
 * opens the list of recipes he knows; using it again with the list open
 * makes the recipe listed, which turns the item into another in the same
 * slot. He has to stand still to look at the list: it closes when he walks,
 * leaves the floor or stops holding the item, and interacting with the world
 * puts it away. Recipes are learned (`teachRecipe`), which a letter does.
 */
export const craftingFeature: Feature = {
  name: 'crafting',
  slices: [knownRecipesSlice, recipeListSlice],

  update(sim) {
    const list = sim.stateOf(recipeListSlice);
    if (list.open && !(isStandingStill(sim) && holdsSomethingToMakeFrom(sim))) list.open = false;
  },
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

/** What using the held item does for crafting, for `features/item`: undefined when the item is not something a recipe is made from, or he is not standing still. */
export function recipeListUse(sim: Sim) {
  const list = sim.stateOf(recipeListSlice);
  if (!isStandingStill(sim) || !holdsSomethingToMakeFrom(sim)) return undefined;
  if (!list.open) return { means: 'openRecipes' as const, perform: () => void (list.open = true) };
  // The list shows at most one recipe he can make, so using the item makes that one. A second recipe from the same
  // item needs a way to choose between them first.
  const recipe = knownRecipes(sim).find((known) => known.madeFrom === selectedItemOf(sim));
  if (!recipe) return { means: 'closeRecipes' as const, perform: () => void (list.open = false) };
  return {
    means: 'craft' as const,
    perform: () => {
      replaceSelectedItem(sim, recipe.makes);
      list.open = false;
    },
  };
}

/** What interacting does while he has the recipe list out, for `features/world`: he puts it away, and the press does nothing else. */
export function recipeListInteraction(sim: Sim) {
  const list = sim.stateOf(recipeListSlice);
  if (!list.open) return undefined;
  return { means: 'closeRecipes' as const, perform: () => void (list.open = false) };
}

// ---- Helpers ----

/** True when the item in the selected slot is what some recipe is made from, whether or not he knows that recipe yet. */
function holdsSomethingToMakeFrom(sim: Sim): boolean {
  const held = selectedItemOf(sim);
  return held !== null && recipeDefs.some((recipe) => recipe.madeFrom === held);
}
