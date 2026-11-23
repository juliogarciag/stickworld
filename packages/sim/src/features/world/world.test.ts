import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { hashSnapshot } from '../../core/snapshot';
import { features } from '..';
import { airplaneOf } from '../airplane/view';
import { flagOf } from '../flag/view';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { itemUseOf } from '../item/view';
import { recipeListOf } from '../crafting/view';
import { letterOf } from '../letter/view';
import { stickManOf } from '../player/view';
import { interactionOf } from './view';

describe("'world/interact' and 'item/use'", () => {
  it('do one thing a press: next to both the airplane and the letter, a press lifts the airplane and the letter stays unread', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    // In play he cannot have an airplane before he has read the letter, so this one is handed to him.
    giveItem(sim, AIRPLANE_ITEM_ID);
    walkTo(sim, letterOf(sim)!.at.x - 0.4);
    sim.step([SELECT_SLOT_1]);
    sim.step([USE_ITEM]);
    expect(airplaneOf(sim)!.state).toBe('resting');
    expect(interactionOf(sim)).toBe('lift');
    sim.step([INTERACT]);
    expect(airplaneOf(sim)!.state).toBe('carried');
    expect(letterOf(sim)).toMatchObject({ beingRead: false });
    expect(interactionOf(sim)).toBe('putDown');
  });

  it('put the letter he is reading away before anything else, whichever key it is, and do nothing more with that press', () => {
    for (const key of [INTERACT, USE_ITEM]) {
      const sim = new Sim({ features, start: { seed: 1, level: 3 } });
      giveItem(sim, PAPER_ITEM_ID);
      sim.step([SELECT_SLOT_1]);
      walkTo(sim, letterOf(sim)!.at.x);
      sim.step([INTERACT]);
      expect(interactionOf(sim)).toBe('putLetterAway');
      expect(itemUseOf(sim)).toBe('putLetterAway');
      sim.step([key]);
      expect(letterOf(sim)).toBeUndefined();
      expect(recipeListOf(sim).open).toBe(false);
    }
  });

  it('put the recipe list away on an interact, and do nothing more with that press: the airplane next to him stays on the floor', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    walkTo(sim, letterOf(sim)!.at.x);
    // Read (which gives the paper), put away, select, open, fold, set down: an airplane at his feet and an empty slot.
    for (const command of [INTERACT, INTERACT, SELECT_SLOT_1, USE_ITEM, USE_ITEM, USE_ITEM]) sim.step([command]);
    giveItem(sim, PAPER_ITEM_ID);
    sim.step([USE_ITEM]);
    expect(recipeListOf(sim).open).toBe(true);
    expect(interactionOf(sim)).toBe('closeRecipes');
    sim.step([INTERACT]);
    expect(recipeListOf(sim).open).toBe(false);
    expect(airplaneOf(sim)!.state).toBe('resting');
    expect(interactionOf(sim)).toBe('lift');
  });

  it.each([{ held: 'yes' }, { held: 1 }, { held: null }, { held: {} }])("ignore an interact whose 'held' is %j", (fields) => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    walkTo(sim, letterOf(sim)!.at.x);
    const before = sim.snapshot().slices;
    sim.step([{ type: 'world/interact', ...fields } as unknown as Command]);
    expect(sim.snapshot().slices).toEqual(before);
    sim.step([{ type: 'world/interact', held: false }]);
    expect(letterOf(sim)!.beingRead).toBe(true);
  });

  it.each(levels.map((level) => [level.id]))('change nothing on level %i when there is nothing to use or interact with', (level) => {
    const sim = new Sim({ features, start: { seed: 1, level } });
    walkTo(sim, stickManOf(sim).feet.x - 1);
    expect(interactionOf(sim)).toBeNull();
    expect(itemUseOf(sim)).toBeNull();
    const untouched = new Sim({ features, snapshot: sim.snapshot() });
    sim.step([INTERACT, USE_ITEM, { type: 'world/interact', held: true }]);
    untouched.step();
    expect(hashSnapshot(sim.snapshot())).toBe(hashSnapshot(untouched.snapshot()));
  });

  it('do nothing once the level is finished', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    giveItem(sim, PAPER_ITEM_ID);
    sim.step([SELECT_SLOT_1]);
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 600 && !flagOf(sim)!.reached; tick += 1) sim.step();
    expect(flagOf(sim)!.reached).toBe(true);
    expect(itemUseOf(sim)).toBeNull();
    expect(interactionOf(sim)).toBeNull();
  });
});

// ---- Helpers ----

const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };
const USE_ITEM: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > stickManOf(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - stickManOf(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}
