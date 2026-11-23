import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import { level3 } from '../../content/levels/level3';
import { TICK_RATE } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { hasAirplane } from '../airplane';
import { airplaneOf } from '../airplane/view';
import { recipeDef } from '../crafting/defs';
import { craftingOf } from '../crafting/view';
import { AIRPLANE_ITEM_ID, isItemDefId, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { itemSlotsOf } from '../inventory/view';
import { stickManOf } from '../player/view';
import { interactionOf } from '../world/view';
import { LETTER, letterDefs } from './defs';
import { letterPlacedIn } from './index';
import { letterOf } from './view';

describe('reading the letter', () => {
  it('lies on the floor where the level places it, and is read only from within reach', () => {
    const sim = onLevel3WithThePaper();
    expect(letterOf(sim)).toEqual({ at: LETTER_AT, height: 0, beingRead: false, text: letterDefs[0]!.text, teaches: 'paper airplane' });
    walkTo(sim, LETTER_AT.x + LETTER.reach + 0.3);
    expect(interactionOf(sim)).toBeNull();
    sim.step([INTERACT]);
    expect(letterOf(sim)!.beingRead).toBe(false);
    walkTo(sim, LETTER_AT.x + LETTER.reach - 0.2);
    sim.step([INTERACT]);
    expect(letterOf(sim)!.beingRead).toBe(true);
  });

  it('teaches its recipe, gives nothing to him who has the paper already, and puts that paper in his hand', () => {
    const sim = onLevel3WithThePaper();
    expect(craftingOf(sim)).toEqual({ knownRecipes: [], canMake: null });
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: false }]);
    readTheLetter(sim);
    const taught = { defId: letterDefs[0]!.teachesRecipe, name: 'paper airplane' };
    expect(craftingOf(sim)).toEqual({ knownRecipes: [taught], canMake: taught });
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true }]);
  });

  it('gives the paper to him who has none, in his hand: a level 3 started on its own can be played', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
    readTheLetter(sim);
    expect(itemSlotsOf(sim)[0]).toMatchObject({ itemDefId: PAPER_ITEM_ID, selected: true });
  });

  it('is put away by interacting again, and then it is gone', () => {
    const sim = onLevel3WithThePaper();
    readTheLetter(sim);
    sim.step([INTERACT]);
    expect(letterOf(sim)).toBeUndefined();
    expect(interactionOf(sim)).toBeNull();
  });

  it('is put away when he walks out of reach or jumps, and not by using an item', () => {
    const walking = onLevel3WithThePaper();
    readTheLetter(walking);
    walking.step([{ type: 'player/walk', direction: 1 }]);
    expect(letterOf(walking)!.beingRead).toBe(true);
    for (let tick = 0; tick < TICK_RATE; tick += 1) walking.step();
    expect(letterOf(walking)).toBeUndefined();

    const jumping = onLevel3WithThePaper();
    readTheLetter(jumping);
    jumping.step([{ type: 'player/jump' }]);
    expect(letterOf(jumping)).toBeUndefined();

    const using = onLevel3WithThePaper();
    readTheLetter(using);
    using.step([{ type: 'item/use' }]);
    expect(letterOf(using)!.beingRead).toBe(true);
    expect(itemSlotsOf(using)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('does not lie there again when the level starts again, as long as he has what it was for', () => {
    const sim = onLevel3WithThePaper();
    readTheLetter(sim);
    sim.step([INTERACT]);
    sim.startLevel(sim.level);
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) sim.step();
    expect(letterOf(sim)).toBeUndefined();
    expect(craftingOf(sim).knownRecipes).toHaveLength(1);
  });
});

describe('a new letter', () => {
  it.each(WAYS_TO_LOSE_THE_AIRPLANE)('falls from the sky to where the old one was after the airplane is lost by %s, and reading it gives a new paper', (_, lose) => {
    const sim = holdingTheAirplane();
    lose(sim);
    for (let tick = 0; tick < 20 * TICK_RATE && hasAirplane(sim); tick += 1) sim.step();
    expect(hasAirplane(sim)).toBe(false);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();

    // Nothing at first, then a letter high above the place, coming down, and at last lying there.
    const heights: number[] = [];
    for (let tick = 0; tick < 20 * TICK_RATE && letterOf(sim)?.height !== 0; tick += 1) {
      sim.step();
      const letter = letterOf(sim);
      if (letter) heights.push(letter.height);
      if (letter) expect(letter.at).toEqual(LETTER_AT);
    }
    expect(heights[0]).toBeGreaterThan(LETTER.fallsFromHeight - 1);
    expect(heights).toEqual([...heights].sort((one, other) => other - one));
    expect(heights[heights.length - 1]).toBe(0);

    walkTo(sim, LETTER_AT.x);
    sim.step([INTERACT]);
    expect(letterOf(sim)!.beingRead).toBe(true);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
    sim.step([INTERACT]);

    // The new paper is in his hand and folds into a new airplane, and no further letter comes while he has it.
    sim.step([USE_ITEM]);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) sim.step();
    expect(letterOf(sim)).toBeUndefined();
  });

  it('cannot be read while it is still coming down', () => {
    const sim = holdingTheAirplane();
    WAYS_TO_LOSE_THE_AIRPLANE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && !letterOf(sim); tick += 1) sim.step();
    walkTo(sim, LETTER_AT.x);
    for (let tick = 0; tick < 20 * TICK_RATE && letterOf(sim)!.height > 0; tick += 1) {
      expect(interactionOf(sim)).toBeNull();
      sim.step([INTERACT]);
      expect(letterOf(sim)!.beingRead).toBe(false);
    }
    expect(interactionOf(sim)).toBe('read');
  });

  it('does not fall while the airplane is anywhere: in his slot, on the floor or over his head', () => {
    const sim = holdingTheAirplane();
    for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) sim.step();
    sim.step([USE_ITEM]);
    for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) sim.step();
    sim.step([INTERACT]);
    expect(airplaneOf(sim)!.state).toBe('carried');
    for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) sim.step();
    expect(letterOf(sim)).toBeUndefined();
  });
});

describe('every letter', () => {
  it.each(letterDefs.map((def) => [def.name, def] as const))('%s says something, teaches a recipe made from the item it gives', (_, def) => {
    expect(def.text.trim().length).toBeGreaterThan(0);
    expect(isItemDefId(def.gives)).toBe(true);
    expect(recipeDef(def.teachesRecipe)?.madeFrom).toBe(def.gives);
  });

  it.each(levels.map((level) => [level.id, level] as const))('level %i places at most one letter, over the floor', (_, level) => {
    const letters = level.placements.filter((placement) => letterDefs.some((def) => def.id === placement.defId));
    expect(letters.length).toBeLessThanOrEqual(1);
    const placed = letterPlacedIn(level);
    if (placed) expect(level.floor.some((segment) => segment.from.x <= placed.at.x - LETTER.reach && placed.at.x + LETTER.reach <= segment.to.x)).toBe(true);
  });
});

// ---- Helpers ----

const LETTER_AT = letterPlacedIn(level3)!.at;
const EDGE = level3.floor[0]!.to.x;

const USE_ITEM: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/** Every way there is to lose the airplane, each as what he does from the moment it is an item in his selected slot. */
const WAYS_TO_LOSE_THE_AIRPLANE: readonly (readonly [string, (sim: Sim) => void])[] = [
  [
    'putting it down too far past the edge',
    (sim) => {
      sim.step([USE_ITEM]);
      sim.step([INTERACT]);
      walkTo(sim, EDGE - 0.2);
      sim.step([INTERACT]);
    },
  ],
  [
    'carrying it off the edge',
    (sim) => {
      sim.step([USE_ITEM]);
      sim.step([INTERACT]);
      sim.step([{ type: 'player/walk', direction: 1 }]);
    },
  ],
  [
    'setting it down from the slot too far past the edge',
    (sim) => {
      walkTo(sim, EDGE - 0.2);
      sim.step([USE_ITEM]);
    },
  ],
  [
    'dying while it rests on the floor',
    (sim) => {
      sim.step([USE_ITEM]);
      sim.step([{ type: 'player/walk', direction: -1 }]);
    },
  ],
];

function onLevel3WithThePaper(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 3 } });
  giveItem(sim, PAPER_ITEM_ID);
  return sim;
}

function readTheLetter(sim: Sim): void {
  walkTo(sim, LETTER_AT.x);
  sim.step([INTERACT]);
  expect(letterOf(sim)!.beingRead).toBe(true);
}

/** He has read the letter, put it away and folded the paper: the airplane is the item in his selected slot. */
function holdingTheAirplane(): Sim {
  const sim = onLevel3WithThePaper();
  readTheLetter(sim);
  for (const command of [INTERACT, USE_ITEM]) sim.step([command]);
  expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
  return sim;
}

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > stickManOf(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - stickManOf(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}
