import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { replaceSelectedItem, getSelectedItem } from '../inventory/held';
import { getRecipeDef, type RecipeDef } from './defs';
import { chosenRecipeSlice, knownRecipesSlice } from './state';

/**
 * Making one item out of another. Using an item that a recipe the stick man knows is
 * made from makes it: the item turns into another in the same slot, with one
 * press. Recipes are learned (`teachRecipe`), which a letter does; an item the stick man
 * knows no recipe for has no use here. When the item makes more than one recipe the
 * stick man knows (the paper: an airplane, a spear), one of them is the chosen
 * one, which the press makes, and switching the use of the item chooses the
 * next (ADR 0009).
 */
export const craftingFeature: Feature = {
  name: 'crafting',
  slices: [knownRecipesSlice, chosenRecipeSlice],
};

/**
 * The stick man knows the recipe `recipeDefId` from now on, and it is the one it means to make.
 * Nothing changes for an id that is not a recipe's.
 */
export function teachRecipe(sim: Sim, recipeDefId: number): void {
  if (getRecipeDef(recipeDefId) === undefined) {
    return;
  }
  const known = sim.getStateOf(knownRecipesSlice);
  if (!known.includes(recipeDefId)) {
    known.push(recipeDefId);
  }
  sim.setStateOf(chosenRecipeSlice, recipeDefId);
}

/**
 * The recipe `recipeDefId` is the one the stick man means to make from now on. Nothing changes for
 * one it does not know.
 */
export function selectRecipe(sim: Sim, recipeDefId: number): void {
  if (sim.getStateOf(knownRecipesSlice).includes(recipeDefId)) {
    sim.setStateOf(chosenRecipeSlice, recipeDefId);
  }
}

/** The recipes the stick man knows, in the order it learned them. */
export function getKnownRecipes(sim: Sim): RecipeDef[] {
  return sim.getStateOf(knownRecipesSlice).flatMap((id) => getRecipeDef(id) ?? []);
}

/**
 * The recipe that using the held item would make, or undefined when the stick man knows none made
 * from it: the chosen one when it is made from that item, and otherwise the last it learned that
 * is.
 */
export function findCraftableRecipe(sim: Sim): RecipeDef | undefined {
  const recipes = getRecipesFromHeldItem(sim);
  const chosen = sim.getStateOf(chosenRecipeSlice);
  return recipes.find((recipe) => recipe.id === chosen) ?? recipes.at(-1);
}

/**
 * The recipe that using the held item would make once its use is switched, or undefined when the
 * stick man knows no second recipe made from it: the next it learned after the one it would make
 * now, and after the last, the first.
 */
export function findRecipeToSwitchTo(sim: Sim): RecipeDef | undefined {
  const recipes = getRecipesFromHeldItem(sim);
  const craftable = findCraftableRecipe(sim);
  const hasChoice = craftable !== undefined && recipes.length > 1;
  if (!hasChoice) {
    return undefined;
  }
  return recipes[(recipes.indexOf(craftable) + 1) % recipes.length];
}

/**
 * What using the held item does for crafting, for `features/item`: it makes the recipe the stick
 * man knows for it, and when it knows another, switching chooses that one. Undefined when the
 * stick man knows none.
 */
export function getCraftingUse(sim: Sim) {
  const recipe = findCraftableRecipe(sim);
  if (!recipe) {
    return undefined;
  }
  const other = findRecipeToSwitchTo(sim);
  return {
    means: 'craft' as const,
    perform: () => void replaceSelectedItem(sim, recipe.makes),
    switchUse: other ? () => sim.setStateOf(chosenRecipeSlice, other.id) : undefined,
  };
}

// ---- Helpers ----

/** The recipes the stick man knows that are made from the item it holds, as it learned them. */
function getRecipesFromHeldItem(sim: Sim): RecipeDef[] {
  const held = getSelectedItem(sim);
  return held === null ? [] : getKnownRecipes(sim).filter((known) => known.madeFrom === held);
}
