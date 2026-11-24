import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import { level3 } from '../../content/levels/level3';
import { TICK_RATE } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import type { SimSnapshot } from '../../core/snapshot';
import { features } from '..';
import { hasAirplane } from '../airplane';
import { AIRPLANE } from '../airplane/defs';
import { airplaneOf } from '../airplane/view';
import { recipeDef } from '../crafting/defs';
import { craftingOf } from '../crafting/view';
import { AIRPLANE_ITEM_ID, isItemDefId, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { itemSlotsOf } from '../inventory/view';
import type { PlayerState } from '../player/state';
import { stickManOf } from '../player/view';
import { interactionOf } from '../world/view';
import { LETTER, letterDefs } from './defs';
import { letterPlacedIn } from './index';
import { letterOf } from './view';

describe('reading the letter', () => {
  it('lies on the floor where the level places it, and is read only from within reach', () => {
    const sim = onLevel3WithThePaper();
    expect(letterOf(sim)).toEqual({ at: LETTER_AT, height: 0, opened: false, beingRead: false, text: letterDefs[0]!.text, teaches: 'paper airplane' });
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

  it('is put away by interacting again, and lies where it lay, opened, to be read again', () => {
    const sim = onLevel3WithThePaper();
    readTheLetter(sim);
    expect(letterOf(sim)).toMatchObject({ beingRead: true, opened: true });
    sim.step([INTERACT]);
    expect(letterOf(sim)).toMatchObject({ at: LETTER_AT, height: 0, beingRead: false, opened: true });
    expect(interactionOf(sim)).toBe('read');
    sim.step([INTERACT]);
    expect(letterOf(sim)).toMatchObject({ beingRead: true, text: letterDefs[0]!.text });
    // Reading it again gives nothing more: he has the paper.
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true }]);
    expect(craftingOf(sim).knownRecipes).toHaveLength(1);
  });

  it('is put away when he walks out of reach or jumps, and not by using an item', () => {
    const walking = onLevel3WithThePaper();
    readTheLetter(walking);
    walking.step([{ type: 'player/walk', direction: 1 }]);
    expect(letterOf(walking)!.beingRead).toBe(true);
    for (let tick = 0; tick < TICK_RATE; tick += 1) walking.step();
    expect(letterOf(walking)).toMatchObject({ beingRead: false, opened: true });

    const jumping = onLevel3WithThePaper();
    readTheLetter(jumping);
    jumping.step([{ type: 'player/jump' }]);
    expect(letterOf(jumping)).toMatchObject({ beingRead: false, opened: true });

    const using = onLevel3WithThePaper();
    readTheLetter(using);
    using.step([{ type: 'item/use' }]);
    expect(letterOf(using)!.beingRead).toBe(true);
    expect(itemSlotsOf(using)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('lies there opened when the level starts again, and no new one comes as long as he has what it was for', () => {
    const sim = onLevel3WithThePaper();
    readTheLetter(sim);
    sim.step([INTERACT]);
    sim.startLevel(sim.level);
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      sim.step();
      expect(letterOf(sim)).toMatchObject({ height: 0, opened: true, beingRead: false });
    }
    expect(craftingOf(sim).knownRecipes).toHaveLength(1);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });
});

describe('a level that starts again', () => {
  it('gives him the airplane at once, in his hand, however he died without it, and no letter falls', () => {
    for (const [way, die] of WAYS_TO_DIE_WITHOUT_THE_AIRPLANE) {
      const sim = holdingTheAirplane();
      die(sim);
      for (let tick = 0; tick < 20 * TICK_RATE && (airplaneOf(sim) || !sameSpot(stickManOf(sim).feet, level3.start)); tick += 1) sim.step();
      expect(stickManOf(sim).feet, way).toEqual(level3.start);
      expect(airplaneOf(sim), way).toBeUndefined();
      expect(itemSlotsOf(sim), way).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
      for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
        sim.step();
        expect(letterOf(sim), way).toMatchObject({ height: 0, opened: true });
      }
    }
  });

  it('puts the letter he was reading back on the floor, and gives him the airplane when he dies while a new letter is on its way down', () => {
    const reading = onLevel3WithThePaper();
    readTheLetter(reading);
    reading.startLevel(reading.level);
    expect(letterOf(reading)).toMatchObject({ beingRead: false, opened: true, height: 0 });

    const sim = holdingTheAirplane();
    WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && letterOf(sim)!.height === 0; tick += 1) sim.step();
    expect(letterOf(sim)).toMatchObject({ opened: false });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 5 * TICK_RATE && !sameSpot(stickManOf(sim).feet, level3.start); tick += 1) sim.step();
    expect(stickManOf(sim).feet).toEqual(level3.start);
    expect(letterOf(sim)).toMatchObject({ opened: true, height: 0 });
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
  });

  it('gives nothing to him who has not read the letter: he has not learned what to make', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    sim.startLevel(sim.level);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
    expect(letterOf(sim)).toMatchObject({ opened: false, height: 0 });
  });

  it('gives nothing more to him who still has the paper or the airplane in his slot', () => {
    const withThePaper = onLevel3WithThePaper();
    readTheLetter(withThePaper);
    withThePaper.startLevel(withThePaper.level);
    expect(itemSlotsOf(withThePaper)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true }]);

    const withTheAirplane = holdingTheAirplane();
    withTheAirplane.startLevel(withTheAirplane.level);
    expect(itemSlotsOf(withTheAirplane)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
  });
});

describe('a new letter', () => {
  it('falls from the sky on to the old one however the airplane is lost by him who lives, and reading it gives a new paper', () => {
    for (const [, lose] of WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE) {
      const sim = holdingTheAirplane();
      lose(sim);
      for (let tick = 0; tick < 20 * TICK_RATE && hasAirplane(sim); tick += 1) sim.step();
      expect(hasAirplane(sim)).toBe(false);
      expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
      expect(letterOf(sim)).toMatchObject({ height: 0, opened: true });

      // The opened one lies there a moment longer, then a new one is high above the place, coming down, and at last lying there, not opened.
      for (let tick = 0; tick < TICK_RATE && letterOf(sim)!.height === 0; tick += 1) sim.step();
      const heights: number[] = [];
      for (let tick = 0; tick < 20 * TICK_RATE && (heights.length === 0 || letterOf(sim)!.height !== 0); tick += 1) {
        const letter = letterOf(sim)!;
        heights.push(letter.height);
        expect(letter).toMatchObject({ at: LETTER_AT, opened: false });
        sim.step();
      }
      expect(heights[0]).toBeGreaterThan(LETTER.fallsFromHeight - 1);
      expect(heights).toEqual([...heights].sort((one, other) => other - one));
      expect(letterOf(sim)).toMatchObject({ height: 0, opened: false });

      walkTo(sim, LETTER_AT.x);
      sim.step([INTERACT]);
      expect(letterOf(sim)!.beingRead).toBe(true);
      expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
      sim.step([INTERACT]);

      // The new paper is in his hand and folds into a new airplane, and no further letter comes while he has it.
      sim.step([USE_ITEM]);
      expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
      for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
        sim.step();
        expect(letterOf(sim)).toMatchObject({ height: 0, opened: true });
      }
    }
  });

  it('is not waited for by him who reads the opened one again first: that gives the paper too, and then none falls', () => {
    const sim = holdingTheAirplane();
    WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE[1]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && hasAirplane(sim); tick += 1) sim.step();
    // Lost from the edge, far from the letter: by the time he is back the new one has landed. Here he is put next to it at once.
    const beside = new Sim({ features, snapshot: besideTheLetter(sim.snapshot()) });
    expect(letterOf(beside)).toMatchObject({ height: 0, opened: true });
    beside.step([INTERACT]);
    expect(itemSlotsOf(beside)[0]).toMatchObject({ itemDefId: PAPER_ITEM_ID, selected: true });
    beside.step([INTERACT]);
    for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
      beside.step();
      expect(letterOf(beside)).toMatchObject({ height: 0, opened: true });
    }
  });

  it('does not fall once the flag is reached: he who jumped out near the far side and lost the airplane needs none', () => {
    const sim = holdingTheAirplane();
    const snapshot = sim.snapshot();
    const flagAt = level3.placements.find((placement) => letterPlacedIn(level3) !== placement)!.at;
    // Put next to the flag with nothing in his slot: the next tick reaches it.
    const atTheFlag = new Sim({ features, snapshot: { ...snapshot, slices: { ...snapshot.slices, inventory: { slots: [null], selectedSlot: 1 }, player: { ...(snapshot.slices.player as PlayerState), x: flagAt.x, y: flagAt.y } } } });
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      atTheFlag.step();
      expect(letterOf(atTheFlag)).toMatchObject({ height: 0, opened: true });
    }
    expect(hasAirplane(atTheFlag)).toBe(false);
  });

  it('cannot be read while it is still coming down', () => {
    const sim = holdingTheAirplane();
    WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && letterOf(sim)!.height === 0; tick += 1) sim.step();
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
    const untouched = (): void => {
      for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
        sim.step();
        expect(letterOf(sim)).toMatchObject({ height: 0, opened: true });
      }
    };
    untouched();
    sim.step([USE_ITEM]);
    untouched();
    sim.step([INTERACT]);
    expect(airplaneOf(sim)!.state).toBe('carried');
    untouched();
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

/** Every way there is to lose the airplane and stay alive, each as what he does from the moment it is an item in his selected slot. */
const WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE: readonly (readonly [string, (sim: Sim) => void])[] = [
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
    'setting it down from the slot too far past the edge',
    (sim) => {
      walkTo(sim, EDGE - 0.2);
      sim.step([USE_ITEM]);
    },
  ],
];

/** Every way there is to die once the airplane is out of his slot, each as what he does from the moment it is an item in his selected slot. */
const WAYS_TO_DIE_WITHOUT_THE_AIRPLANE: readonly (readonly [string, (sim: Sim) => void])[] = [
  [
    'carrying it off the edge',
    (sim) => {
      sim.step([USE_ITEM]);
      sim.step([INTERACT]);
      sim.step([{ type: 'player/walk', direction: 1 }]);
    },
  ],
  [
    'flying it into the gap',
    (sim) => {
      sim.step([USE_ITEM]);
      sim.step([INTERACT]);
      walkTo(sim, EDGE - AIRPLANE.putDownAhead - 0.2);
      sim.step([INTERACT]);
      sim.step([INTERACT]);
      expect(airplaneOf(sim)!.state).toBe('flying');
    },
  ],
  [
    'jumping out of it over the gap',
    (sim) => {
      sim.step([USE_ITEM]);
      sim.step([INTERACT]);
      walkTo(sim, EDGE - AIRPLANE.putDownAhead - 0.2);
      sim.step([INTERACT]);
      sim.step([INTERACT]);
      for (let tick = 0; tick < 20; tick += 1) sim.step();
      sim.step([{ type: 'player/jump' }]);
      expect(stickManOf(sim).action).toBe('jumping');
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

function sameSpot(one: { x: number; y: number }, other: { x: number; y: number }): boolean {
  return one.x === other.x && one.y === other.y;
}

/** The same game with him standing still on the floor next to the letter. */
function besideTheLetter(snapshot: SimSnapshot): SimSnapshot {
  const player = snapshot.slices.player as PlayerState;
  return { ...snapshot, slices: { ...snapshot.slices, player: { ...player, x: LETTER_AT.x, y: 0, onFloor: true, walkDirection: 0, horizontalSpeed: 0 } } };
}

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
