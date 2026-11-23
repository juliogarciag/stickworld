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
import { recipeListOf } from './view';

describe('the recipe list', () => {
  it('opens when he uses the paper, listing only the recipes he knows', () => {
    const sim = withThePaperSelected();
    expect(recipeListOf(sim)).toEqual({ open: false, recipes: [] });
    sim.step([USE_ITEM]);
    expect(recipeListOf(sim)).toEqual({ open: true, recipes: [] });

    const taught = withThePaperSelected();
    teachRecipe(taught, PAPER_AIRPLANE_RECIPE_ID);
    taught.step([USE_ITEM]);
    expect(recipeListOf(taught)).toEqual({ open: true, recipes: [{ defId: PAPER_AIRPLANE_RECIPE_ID, name: 'paper airplane' }] });
  });

  it('does not open without the paper selected', () => {
    const unselected = withThePaperSelected();
    unselected.step([SELECT_SLOT_1]);
    expect(itemUseOf(unselected)).toBeNull();
    unselected.step([USE_ITEM]);
    expect(recipeListOf(unselected).open).toBe(false);

    const emptyHanded = new Sim({ features, start: { seed: 1, level: 1 } });
    emptyHanded.step([SELECT_SLOT_1]);
    emptyHanded.step([USE_ITEM]);
    expect(recipeListOf(emptyHanded).open).toBe(false);
  });

  it('turns the paper into the airplane in the same slot when he uses the paper again, and closes', () => {
    const sim = withThePaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    sim.step([USE_ITEM]);
    sim.step([USE_ITEM]);
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
    expect(recipeListOf(sim).open).toBe(false);
  });

  it('closes with nothing made when he knows no recipe and uses the paper again', () => {
    const sim = withThePaperSelected();
    sim.step([USE_ITEM]);
    sim.step([USE_ITEM]);
    expect(recipeListOf(sim).open).toBe(false);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it.each<[string, Command]>([
    ['walks', { type: 'player/walk', direction: 1 }],
    ['jumps', { type: 'player/jump' }],
    ['unselects the paper', SELECT_SLOT_1],
    ['interacts with the world', { type: 'world/interact' }],
  ])('closes with nothing made when he %s', (_, command) => {
    const sim = withThePaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    sim.step([USE_ITEM]);
    sim.step([command]);
    expect(recipeListOf(sim).open).toBe(false);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('does not open while he walks: he stands still to look at it', () => {
    const sim = withThePaperSelected();
    sim.step([{ type: 'player/walk', direction: 1 }]);
    expect(itemUseOf(sim)).toBeNull();
    sim.step([USE_ITEM]);
    expect(recipeListOf(sim).open).toBe(false);
  });

  it('is closed when a level starts again, and what he learned is kept', () => {
    const sim = withThePaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    sim.step([USE_ITEM]);
    sim.startLevel(sim.level);
    expect(recipeListOf(sim)).toEqual({ open: false, recipes: [{ defId: PAPER_AIRPLANE_RECIPE_ID, name: 'paper airplane' }] });
  });

  it('teaches a recipe once, and nothing that is not a recipe', () => {
    const sim = withThePaperSelected();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    teachRecipe(sim, PAPER_ITEM_ID);
    teachRecipe(sim, Number.NaN);
    expect(recipeListOf(sim).recipes).toHaveLength(1);
  });
});

describe('every recipe', () => {
  it.each(recipeDefs.map((recipe) => [recipe.name, recipe] as const))('%s is a def made from one item into another', (_, recipe) => {
    expect(getDef(recipe.id)).toBe(recipe);
    expect(isItemDefId(recipe.madeFrom)).toBe(true);
    expect(isItemDefId(recipe.makes)).toBe(true);
    expect(recipe.makes).not.toBe(recipe.madeFrom);
  });

  it('is the only one made from its item: using the item makes the one listed, with no way to choose yet', () => {
    const madeFrom = recipeDefs.map((recipe) => recipe.madeFrom);
    expect(new Set(madeFrom).size).toBe(madeFrom.length);
  });
});

// ---- Helpers ----

const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };
const USE_ITEM: Command = { type: 'item/use' };

function withThePaperSelected(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 1 } });
  giveItem(sim, PAPER_ITEM_ID);
  sim.step([SELECT_SLOT_1]);
  return sim;
}
