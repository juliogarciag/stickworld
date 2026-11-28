import { describe, expect, it } from 'vitest';
import { getDef } from '../../content/defs';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { AIRPLANE_ITEM_ID, isItemDefId, PAPER_ITEM_ID, SPEAR_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { canSwitchItemUse, getItemUse } from '../item/view';
import { PAPER_AIRPLANE_RECIPE_ID, recipeDefs, SPEAR_RECIPE_ID } from './defs';
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
    expect(getCrafting(sim)).toEqual({ knownRecipes: [], canMake: null, couldMakeInstead: null });
    sim.step([USE_ITEM]);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it("needs the paper in the stick man's hand", () => {
    const unselected = createSimWithPaperSelected();
    teachRecipe(unselected, PAPER_AIRPLANE_RECIPE_ID);
    unselected.step([SELECT_SLOT_1]);
    expect(getItemUse(unselected)).toBeNull();
    expect(getCrafting(unselected)).toEqual({
      knownRecipes: [PAPER_AIRPLANE],
      canMake: null,
      couldMakeInstead: null,
    });
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
    expect(getCrafting(sim)).toEqual({
      knownRecipes: [PAPER_AIRPLANE],
      canMake: PAPER_AIRPLANE,
      couldMakeInstead: null,
    });
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

describe('two recipes made from the same item', () => {
  it('makes the one learned last with one press, and says what the other is', () => {
    const sim = createSimKnowingBoth();
    expect(getCrafting(sim)).toMatchObject({ canMake: SPEAR, couldMakeInstead: PAPER_AIRPLANE });
    expect(canSwitchItemUse(sim)).toBe(true);
    sim.step([USE_ITEM]);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(SPEAR_ITEM_ID);
  });

  it('switches to the other and back again, and the press makes the one chosen', () => {
    const sim = createSimKnowingBoth();
    sim.step([SWITCH_USE]);
    expect(getCrafting(sim)).toMatchObject({ canMake: PAPER_AIRPLANE, couldMakeInstead: SPEAR });
    sim.step([SWITCH_USE]);
    expect(getCrafting(sim)).toMatchObject({ canMake: SPEAR, couldMakeInstead: PAPER_AIRPLANE });
    sim.step([SWITCH_USE]);
    sim.step([USE_ITEM]);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
  });

  it('keeps the choice when a level starts again, and in a snapshot', () => {
    const sim = createSimKnowingBoth();
    sim.step([SWITCH_USE]);
    const restored = new Sim({ features, snapshot: sim.takeSnapshot() });
    expect(getCrafting(restored).canMake).toEqual(PAPER_AIRPLANE);
    sim.startLevel(sim.level);
    expect(getCrafting(sim).canMake).toEqual(PAPER_AIRPLANE);
  });

  it('has nothing to switch with one recipe known, with no paper in its hand, or with an item that makes nothing', () => {
    const one = createSimWithPaperSelected();
    teachRecipe(one, PAPER_AIRPLANE_RECIPE_ID);
    expect(canSwitchItemUse(one)).toBe(false);
    one.step([SWITCH_USE]);
    expect(getCrafting(one).canMake).toEqual(PAPER_AIRPLANE);

    const unselected = createSimKnowingBoth();
    unselected.step([SELECT_SLOT_1]);
    expect(canSwitchItemUse(unselected)).toBe(false);
    unselected.step([SWITCH_USE]);
    unselected.step([SELECT_SLOT_1]);
    expect(getCrafting(unselected).canMake).toEqual(SPEAR);

    const made = createSimKnowingBoth();
    made.step([USE_ITEM]);
    expect(canSwitchItemUse(made)).toBe(false);
    expect(getCrafting(made).couldMakeInstead).toBeNull();
  });

  it('switches and makes in one tick, in the order the two were pressed', () => {
    const switchedFirst = createSimKnowingBoth();
    switchedFirst.step([SWITCH_USE, USE_ITEM]);
    expect(getItemSlots(switchedFirst)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
    const madeFirst = createSimKnowingBoth();
    madeFirst.step([USE_ITEM, SWITCH_USE]);
    expect(getItemSlots(madeFirst)[0]?.itemDefId).toBe(SPEAR_ITEM_ID);
  });

  it('makes a recipe learned again the chosen one', () => {
    const sim = createSimKnowingBoth();
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    expect(getCrafting(sim).canMake).toEqual(PAPER_AIRPLANE);
    expect(getCrafting(sim).knownRecipes).toHaveLength(2);
  });
});

describe('every recipe', () => {
  it.each(recipeDefs.map((recipe) => [recipe.name, recipe] as const))(
    '%s is a def made from one item into another',
    (_, recipe) => {
      expect(getDef(recipe.id)).toBe(recipe);
      expect(isItemDefId(recipe.madeFrom)).toBe(true);
      expect(isItemDefId(recipe.makes)).toBe(true);
      expect(recipe.makes).not.toBe(recipe.madeFrom);
    },
  );
});

// ---- Helpers ----

const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };
const USE_ITEM: Command = { type: 'item/use' };
const SWITCH_USE: Command = { type: 'item/switchUse' };
const SPEAR = { defId: SPEAR_RECIPE_ID, name: 'spear' };
const PAPER_AIRPLANE = { defId: PAPER_AIRPLANE_RECIPE_ID, name: 'paper airplane' };

function createSimWithPaperSelected(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 1 } });
  giveItem(sim, PAPER_ITEM_ID);
  sim.step([SELECT_SLOT_1]);
  return sim;
}

/** The paper in its hand, and both things it knows to make of it: the airplane, then the spear. */
function createSimKnowingBoth(): Sim {
  const sim = createSimWithPaperSelected();
  teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
  teachRecipe(sim, SPEAR_RECIPE_ID);
  return sim;
}
