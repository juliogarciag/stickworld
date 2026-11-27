import { defineSlice } from '../../core/slice';

/**
 * The def ids of the recipes the stick man knows, in the order it learned them. What the stick man
 * has learned it keeps: it carries across levels and deaths.
 */
export const knownRecipesSlice = defineSlice<number[]>('knownRecipes', () => [], {
  isCarriedAcrossLevels: true,
});
