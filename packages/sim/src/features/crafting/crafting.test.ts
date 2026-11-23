import { describe, expect, it } from 'vitest';
import { getDef } from '../../content/defs';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { AIRPLANE_ITEM_ID, isItemDefId, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { itemSlotsOf } from '../inventory/view';
import { itemUseOf } from '../item/view';
import { PAPER_AIRPLANE_RECIPE_ID, recipeDefs } from './defs';
import { teachRecipe } from './index';
import { craftingOf } from './view';

describe('making a recipe', () => {
  it('turns the paper into the airplane in the same slot with one use, once he knows how', () => {
    const sim = withThePaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    expect(itemUseOf(sim)).toBe('craft');
    expect(craftingOf(sim).canMake).toEqual(PAPER_AIRPLANE);
    sim.step([USE_ITEM]);
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
    expect(craftingOf(sim).canMake).toBeNull();
  });

  it('is nothing the paper can do while he knows no recipe for it', () => {
    const sim = withThePaperSelected();
    expect(itemUseOf(sim)).toBeNull();
    expect(craftingOf(sim)).toEqual({ knownRecipes: [], canMake: null });
    sim.step([USE_ITEM]);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('needs the paper in his hand', () => {
    const unselected = withThePaperSelected();
    teachRecipe(unselected, PAPER_AIRPLANE_RECIPE_ID);
    unselected.step([SELECT_SLOT_1]);
    expect(itemUseOf(unselected)).toBeNull();
    expect(craftingOf(unselected)).toEqual({ knownRecipes: [PAPER_AIRPLANE], canMake: null });
    unselected.step([USE_ITEM]);
    expect(itemSlotsOf(unselected)[0]?.itemDefId).toBe(PAPER_ITEM_ID);

    const emptyHanded = new Sim({ features, start: { seed: 1, level: 1 } });
    teachRecipe(emptyHanded, PAPER_AIRPLANE_RECIPE_ID);
    emptyHanded.step([SELECT_SLOT_1]);
    expect(itemUseOf(emptyHanded)).toBeNull();
  });

  it('can be done while he walks or is in the air: there is nothing to stop and look at', () => {
    const walking = withThePaperSelected();
    teachRecipe(walking, PAPER_AIRPLANE_RECIPE_ID);
    walking.step([{ type: 'player/walk', direction: 1 }]);
    walking.step([{ type: 'player/jump' }]);
    expect(itemUseOf(walking)).toBe('craft');
    walking.step([USE_ITEM]);
    expect(itemSlotsOf(walking)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
  });

  it('is kept when a level starts again: what he learned he knows', () => {
    const sim = withThePaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    sim.startLevel(sim.level);
    expect(craftingOf(sim)).toEqual({ knownRecipes: [PAPER_AIRPLANE], canMake: PAPER_AIRPLANE });
  });

  it('teaches a recipe once, and nothing that is not a recipe', () => {
    const sim = withThePaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    teachRecipe(sim, PAPER_ITEM_ID);
    teachRecipe(sim, Number.NaN);
    expect(craftingOf(sim).knownRecipes).toHaveLength(1);
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

function withThePaperSelected(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 1 } });
  giveItem(sim, PAPER_ITEM_ID);
  sim.step([SELECT_SLOT_1]);
  return sim;
}
