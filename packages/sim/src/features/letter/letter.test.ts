import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import { level3 } from '../../content/levels/level3';
import { TICK_RATE } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { hasAirplane } from '../airplane';
import { AIRPLANE } from '../airplane/defs';
import { airplaneOf } from '../airplane/view';
import { checkpointOf } from '../checkpoint/view';
import { recipeDef } from '../crafting/defs';
import { craftingOf } from '../crafting/view';
import { AIRPLANE_ITEM_ID, isItemDefId, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { itemSlotsOf } from '../inventory/view';
import { stickManOf } from '../player/view';
import { interactionOf } from '../world/view';
import { LETTER, letterDefs } from './defs';
import { letterPlacedIn } from './index';
import { fallenItemOf, letterOf } from './view';

describe('reading the letter', () => {
  it('lies on the floor where the level places it, and is read only from within reach', () => {
    const sim = onLevel3WithThePaper();
    expect(letterOf(sim)).toEqual({ at: LETTER_AT, beingRead: false, text: letterDefs[0]!.text, teaches: 'paper airplane' });
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

  it('is put away by interacting again, and then it is gone: what it taught he knows for good', () => {
    const sim = onLevel3WithThePaper();
    readTheLetter(sim);
    sim.step([INTERACT]);
    expect(letterOf(sim)).toBeUndefined();
    expect(interactionOf(sim)).toBeNull();
    expect(craftingOf(sim).knownRecipes).toHaveLength(1);
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

  it('does not lie there again when the level starts again, and no new one comes as long as he has what it was for', () => {
    const sim = onLevel3WithThePaper();
    readTheLetter(sim);
    sim.step([INTERACT]);
    sim.startLevel(sim.level);
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      sim.step();
      expect(letterOf(sim)).toBeUndefined();
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
      // Some of these ways go past the level's checkpoint before he dies and some do not: either the level starts him at its start, or there.
      const backWhereTheLevelStartsHim = (): boolean => sameSpot(stickManOf(sim).feet, checkpointOf(sim)!.passed ? level3.checkpoint! : level3.start);
      for (let tick = 0; tick < 20 * TICK_RATE && (airplaneOf(sim) || !backWhereTheLevelStartsHim()); tick += 1) sim.step();
      expect(backWhereTheLevelStartsHim(), way).toBe(true);
      expect(airplaneOf(sim), way).toBeUndefined();
      expect(itemSlotsOf(sim), way).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
      for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
        sim.step();
        expect(letterOf(sim), way).toBeUndefined();
        expect(fallenItemOf(sim), way).toBeUndefined();
      }
    }
  });

  it('takes the letter he was reading with it, and gives him the airplane when he dies while a new sheet of paper is on its way down', () => {
    const reading = onLevel3WithThePaper();
    readTheLetter(reading);
    reading.startLevel(reading.level);
    expect(letterOf(reading)).toBeUndefined();

    const sim = holdingTheAirplane();
    WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && !fallenItemOf(sim); tick += 1) sim.step();
    expect(fallenItemOf(sim)!.height).toBeGreaterThan(0);
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 5 * TICK_RATE && !sameSpot(stickManOf(sim).feet, level3.checkpoint!); tick += 1) sim.step();
    expect(stickManOf(sim).feet).toEqual(level3.checkpoint);
    expect(letterOf(sim)).toBeUndefined();
    expect(fallenItemOf(sim)).toBeUndefined();
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
  });

  it('gives nothing to him who has not read the letter: he has not learned what to make', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    sim.startLevel(sim.level);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
    expect(letterOf(sim)).toMatchObject({ beingRead: false });
    expect(fallenItemOf(sim)).toBeUndefined();
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

describe('a new sheet of paper', () => {
  it('falls from the sky to where he stands however the airplane is lost by him who lives, and is picked up into his hand', () => {
    for (const [, lose] of WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE) {
      const sim = holdingTheAirplane();
      lose(sim);
      for (let tick = 0; tick < 20 * TICK_RATE && hasAirplane(sim); tick += 1) sim.step();
      expect(hasAirplane(sim)).toBe(false);
      expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
      expect(fallenItemOf(sim)).toBeUndefined();

      // Nothing at first, then a sheet high above the place, coming down, and at last lying there. It is the paper, and no letter.
      for (let tick = 0; tick < TICK_RATE && !fallenItemOf(sim); tick += 1) sim.step();
      const heights: number[] = [];
      // He lost it at the edge, far from where the letter lay: the sheet comes to him.
      const stoodAt = stickManOf(sim).feet;
      expect(stoodAt.x).toBeGreaterThan(LETTER_AT.x + 3);
      for (let tick = 0; tick < 20 * TICK_RATE && (heights.length === 0 || fallenItemOf(sim)!.height !== 0); tick += 1) {
        const fallen = fallenItemOf(sim)!;
        heights.push(fallen.height);
        expect(fallen).toMatchObject({ at: stoodAt, itemDefId: PAPER_ITEM_ID });
        expect(letterOf(sim)).toBeUndefined();
        sim.step();
      }
      expect(heights[0]).toBeGreaterThan(LETTER.fallsFromHeight - 1);
      expect(heights).toEqual([...heights].sort((one, other) => other - one));
      expect(fallenItemOf(sim)!.height).toBe(0);

      // It lies at his feet. One press picks it up: nothing is read, and it is in his hand, where the next press folds it.
      expect(interactionOf(sim)).toBe('pickUp');
      sim.step([INTERACT]);
      expect(fallenItemOf(sim)).toBeUndefined();
      expect(letterOf(sim)).toBeUndefined();
      expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true }]);
      expect(interactionOf(sim)).toBeNull();
      sim.step([USE_ITEM]);
      expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);

      // No further sheet comes while he has it.
      for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
        sim.step();
        expect(fallenItemOf(sim)).toBeUndefined();
      }
    }
  });

  it('does not fall for him who has not read the letter: the letter lies there and gives the paper', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      sim.step();
      expect(fallenItemOf(sim)).toBeUndefined();
    }
    expect(letterOf(sim)).toBeDefined();
  });

  it('is in the snapshot: restored on its way down, it lands and is picked up the same', () => {
    const sim = holdingTheAirplane();
    WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && !fallenItemOf(sim); tick += 1) sim.step();
    for (let tick = 0; tick < 20; tick += 1) sim.step();
    const restored = new Sim({ features, snapshot: sim.snapshot() });
    expect(fallenItemOf(restored)).toEqual(fallenItemOf(sim));
    for (const each of [sim, restored]) for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) each.step();
    expect(restored.snapshot()).toEqual(sim.snapshot());
    expect(fallenItemOf(restored)!.height).toBe(0);
  });

  it('does not fall once the flag is reached: he who jumped out near the far side and lost the airplane needs none', () => {
    const sim = holdingTheAirplane();
    const snapshot = sim.snapshot();
    const flagAt = level3.placements.find((placement) => letterPlacedIn(level3) !== placement)!.at;
    // Put next to the flag with nothing in his slot: the next tick reaches it.
    const atTheFlag = new Sim({ features, snapshot: { ...snapshot, slices: { ...snapshot.slices, inventory: { slots: [null], selectedSlot: 1 }, player: { ...(snapshot.slices.player as object), x: flagAt.x, y: flagAt.y } } } });
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      atTheFlag.step();
      expect(fallenItemOf(atTheFlag)).toBeUndefined();
    }
    expect(hasAirplane(atTheFlag)).toBe(false);
  });

  it('cannot be picked up while it is still coming down, nor from out of reach once it lies there', () => {
    const sim = holdingTheAirplane();
    WAYS_TO_LOSE_THE_AIRPLANE_AND_LIVE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && !fallenItemOf(sim); tick += 1) sim.step();
    for (let tick = 0; tick < 20 * TICK_RATE && fallenItemOf(sim)!.height > 0; tick += 1) {
      expect(interactionOf(sim)).toBeNull();
      sim.step([INTERACT]);
      expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
    }
    expect(interactionOf(sim)).toBe('pickUp');
    // It stays where it fell when he walks away from it, and is out of reach from there.
    const fellAt = fallenItemOf(sim)!.at;
    walkTo(sim, fellAt.x - LETTER.reach - 0.3);
    expect(fallenItemOf(sim)).toMatchObject({ at: fellAt, height: 0 });
    expect(interactionOf(sim)).toBeNull();
    walkTo(sim, fellAt.x - LETTER.reach + 0.2);
    expect(interactionOf(sim)).toBe('pickUp');
  });

  it('waits for him to land: one he lost in the air gets its sheet where he comes down, never over a gap', () => {
    const sim = holdingTheAirplane();
    for (const command of [USE_ITEM, INTERACT]) sim.step([command]);
    walkTo(sim, EDGE - 1);
    sim.step([{ type: 'player/jump' }]);
    for (let tick = 0; tick < 3; tick += 1) sim.step();
    // In the air he puts nothing down: he lands, and then sets it down past the edge to lose it.
    for (let tick = 0; tick < TICK_RATE; tick += 1) sim.step();
    walkTo(sim, EDGE - 0.2);
    sim.step([INTERACT]);
    sim.step([{ type: 'player/jump' }]);
    let sawItStartWhileHeWasInTheAir = false;
    let ticksInTheAirWhileItWasDue = 0;
    for (let tick = 0; tick < 20 * TICK_RATE && !(fallenItemOf(sim)?.height === 0); tick += 1) {
      const wasThere = fallenItemOf(sim) !== undefined;
      sim.step(tick % 30 === 0 ? [{ type: 'player/jump' }] : []);
      const inTheAir = stickManOf(sim).action === 'jumping';
      // The tick it appears on, he is on the floor.
      if (!wasThere && fallenItemOf(sim) && inTheAir) sawItStartWhileHeWasInTheAir = true;
      if (!fallenItemOf(sim) && inTheAir && tick > LETTER.fallsAfter * TICK_RATE + 2) ticksInTheAirWhileItWasDue += 1;
    }
    // It was due while he was in a jump, and did wait.
    expect(ticksInTheAirWhileItWasDue).toBeGreaterThan(0);
    expect(sawItStartWhileHeWasInTheAir).toBe(false);
    const fellAt = fallenItemOf(sim)!.at;
    expect(fellAt.y).toBe(0);
    expect(level3.floor.some((segment) => segment.from.x <= fellAt.x && fellAt.x <= segment.to.x)).toBe(true);
  });

  it('does not fall while the airplane is anywhere: in his slot, on the floor or over his head', () => {
    const sim = holdingTheAirplane();
    const untouched = (): void => {
      for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
        sim.step();
        expect(fallenItemOf(sim)).toBeUndefined();
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
