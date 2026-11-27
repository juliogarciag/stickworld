import { describe, expect, it } from 'vitest';
import { getDef } from '../../content/defs';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { AIRPLANE_ITEM_ID, isItemDefId, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { getItemUse } from '../item/view';
import { PAPER_AIRPLANE_RECIPE_ID, recipeDefs } from './defs';
import { teachRecipe } from './index';
import { getCrafting } from './view';

describe('making a recipe', () => {
  it('turns the paper into the airplane in the same slot with one use, once the stick man knows how', () => {
    const sim = createSimWithPaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    expect(getItemUse(sim)).toBe('craft');
    expect(getCrafting(sim).canMake).toEqual(PAPER_AIRPLANE);
    sim.step([USE_ITEM]);
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, isSelected: true }]);
    expect(getCrafting(sim).canMake).toBeNull();
  });

  it('is nothing the paper can do while the stick man knows no recipe for it', () => {
    const sim = createSimWithPaperSelected();
    expect(getItemUse(sim)).toBeNull();
    expect(getCrafting(sim)).toEqual({ knownRecipes: [], canMake: null });
    sim.step([USE_ITEM]);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('needs the paper in the stick man's hand', () => {
    const unselected = createSimWithPaperSelected();
    teachRecipe(unselected, PAPER_AIRPLANE_RECIPE_ID);
    unselected.step([SELECT_SLOT_1]);
    expect(getItemUse(unselected)).toBeNull();
    expect(getCrafting(unselected)).toEqual({ knownRecipes: [PAPER_AIRPLANE], canMake: null });
    unselected.step([USE_ITEM]);
    expect(getItemSlots(unselected)[0]?.itemDefId).toBe(PAPER_ITEM_ID);

    const emptyHanded = new Sim({ features, start: { seed: 1, level: 1 } });
    teachRecipe(emptyHanded, PAPER_AIRPLANE_RECIPE_ID);
    emptyHanded.step([SELECT_SLOT_1]);
    expect(getItemUse(emptyHanded)).toBeNull();
  });

  it('can be done while the stick man walks or is in the air: there is nothing to stop and look at', () => {
    const walking = createSimWithPaperSelected();
    teachRecipe(walking, PAPER_AIRPLANE_RECIPE_ID);
    walking.step([{ type: 'player/walk', direction: 1 }]);
    walking.step([{ type: 'player/jump' }]);
    expect(getItemUse(walking)).toBe('craft');
    walking.step([USE_ITEM]);
    expect(getItemSlots(walking)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
  });

  it('is kept when a level starts again: what the stick man learned it knows', () => {
    const sim = createSimWithPaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    sim.startLevel(sim.level);
    expect(getCrafting(sim)).toEqual({ knownRecipes: [PAPER_AIRPLANE], canMake: PAPER_AIRPLANE });
  });

  it('teaches a recipe once, and nothing that is not a recipe', () => {
    const sim = createSimWithPaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    teachRecipe(sim, PAPER_ITEM_ID);
    teachRecipe(sim, Number.NaN);
    expect(getCrafting(sim).knownRecipes).toHaveLength(1);
  });
});

describe('every recipe', () => {
  it.each(recipeDefs.map((recipe) => [recipe.name, recipe] as const))('%s is a def made from one item into another', (_, recipe) => {
    expect(getDef(recipe.id)).toBe(recipe);
    expect(isItemDefId(recipe.madeFrom)).toBe(true);
    expect(isItemDefId(recipe.makes)).toBe(true);
    expect(recipe.makes).not.toBe(recipe.madeFrom);
  });

  it('is the only one made from its item: using the item makes it, with no list to choose from yet', () => {
    const madeFrom = recipeDefs.map((recipe) => recipe.madeFrom);
    expect(new Set(madeFrom).size).toBe(madeFrom.length);
  });
});

// ---- Helpers ----

const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };
const USE_ITEM: Command = { type: 'item/use' };
const PAPER_AIRPLANE = { defId: PAPER_AIRPLANE_RECIPE_ID, name: 'paper airplane' };

function createSimWithPaperSelected(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 1 } });
  giveItem(sim, PAPER_ITEM_ID);
  sim.step([SELECT_SLOT_1]);
  return sim;
}
