import { defineSlice } from '../../core/slice';

/**
 * The def ids of the recipes the stick man knows, in the order it learned them. What the stick man
 * has learned it keeps: it carries across levels and deaths.
 */
export const knownRecipesSlice = defineSlice<number[]>('knownRecipes', () => [], {
  isCarriedAcrossLevels: true,
});

/**
 * The def id of the recipe the stick man means to make when the item it holds makes more than one
 * it knows, or null before it has learned any. Learning a recipe chooses it, and so does a level
 * starting with its letter read; the player switches with `'item/switchUse'`. It is kept across
 * levels and deaths with what the stick man knows.
 */
export const chosenRecipeSlice = defineSlice<number | null>('chosenRecipe', () => null, {
  isCarriedAcrossLevels: true,
});
