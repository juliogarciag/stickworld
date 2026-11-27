import { defineSlice } from '../../core/slice';

/**
 * The def ids of the recipes he knows, in the order he learned them. What he
 * has learned he keeps: it carries across levels and deaths.
 */
export const knownRecipesSlice = defineSlice<number[]>('knownRecipes', () => [], { isCarriedAcrossLevels: true });
