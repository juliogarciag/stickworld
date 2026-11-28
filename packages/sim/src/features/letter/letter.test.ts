import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import { clubYard } from '../../content/levels/clubYard';
import { level3 } from '../../content/levels/level3';
import { TICK_RATE } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { hasAirplane } from '../airplane';
import { AIRPLANE } from '../airplane/defs';
import { getAirplane } from '../airplane/view';
import { getRecipeDef } from '../crafting/defs';
import { getCrafting } from '../crafting/view';
import { AIRPLANE_ITEM_ID, isItemDefId, PAPER_ITEM_ID, PENCIL_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { getItemUse } from '../item/view';
import { getStickMan } from '../player/view';
import { getInteraction } from '../world/view';
import { LETTER, letterDefs, SPEAR_LETTER_ID } from './defs';
import { findLetterPlacedIn } from './index';
import { getFallenItem, getLetter } from './view';

describe('reading the letter', () => {
  it('lies on the floor where the level places it, and is read only from within reach', () => {
    const sim = createSimOnLevel3WithPaper();
    expect(getLetter(sim)).toEqual({
      position: LETTER_AT,
      isBeingRead: false,
      text: letterDefs[0]!.text,
      teaches: 'paper airplane',
    });
    walkTo(sim, LETTER_AT.x + LETTER.reach + 0.3);
    expect(getInteraction(sim)).toBeNull();
    sim.step([INTERACT]);
    expect(getLetter(sim)!.isBeingRead).toBe(false);
    walkTo(sim, LETTER_AT.x + LETTER.reach - 0.2);
    sim.step([INTERACT]);
    expect(getLetter(sim)!.isBeingRead).toBe(true);
  });

  it("teaches its recipe, gives nothing to the stick man who has the paper already, and puts that paper in the stick man's hand", () => {
    const sim = createSimOnLevel3WithPaper();
    expect(getCrafting(sim)).toEqual({ knownRecipes: [], canMake: null });
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: false }]);
    readLetter(sim);
    const taught = { defId: letterDefs[0]!.teachesRecipe, name: 'paper airplane' };
    expect(getCrafting(sim)).toEqual({ knownRecipes: [taught], canMake: taught });
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: true }]);
  });

  it("gives the paper to the stick man who has none, in the stick man's hand: a level 3 started on its own can be played", () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    readLetter(sim);
    expect(getItemSlots(sim)[0]).toMatchObject({ itemDefId: PAPER_ITEM_ID, isSelected: true });
  });

  it('is put away by interacting again, and then it is gone: what it taught the stick man knows for good', () => {
    const sim = createSimOnLevel3WithPaper();
    readLetter(sim);
    sim.step([INTERACT]);
    expect(getLetter(sim)).toBeUndefined();
    expect(getInteraction(sim)).toBeNull();
    expect(getCrafting(sim).knownRecipes).toHaveLength(1);
  });

  it('is put away when the stick man walks out of reach or jumps, and not by using an item', () => {
    const walking = createSimOnLevel3WithPaper();
    readLetter(walking);
    walking.step([{ type: 'player/walk', direction: 1 }]);
    expect(getLetter(walking)!.isBeingRead).toBe(true);
    for (let tick = 0; tick < TICK_RATE; tick += 1) {
      walking.step();
    }
    expect(getLetter(walking)).toBeUndefined();

    const jumping = createSimOnLevel3WithPaper();
    readLetter(jumping);
    jumping.step([{ type: 'player/jump' }]);
    expect(getLetter(jumping)).toBeUndefined();

    const using = createSimOnLevel3WithPaper();
    readLetter(using);
    using.step([{ type: 'item/use' }]);
    expect(getLetter(using)!.isBeingRead).toBe(true);
    expect(getItemSlots(using)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('does not lie there again when the level starts again, and no new one comes as long as the stick man has what it was for', () => {
    const sim = createSimOnLevel3WithPaper();
    readLetter(sim);
    sim.step([INTERACT]);
    sim.startLevel(sim.level);
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      sim.step();
      expect(getLetter(sim)).toBeUndefined();
    }
    expect(getCrafting(sim).knownRecipes).toHaveLength(1);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });
});

describe('a level that starts again', () => {
  it("gives the stick man the airplane at once, in the stick man's hand, however the stick man died without it, and no letter falls", () => {
    for (const [way, die] of WAYS_TO_DIE_WITHOUT_AIRPLANE) {
      const sim = createSimHoldingAirplane();
      die(sim);
      for (
        let tick = 0;
        tick < 20 * TICK_RATE &&
        (getAirplane(sim) || !isSameSpot(getStickMan(sim).feet, level3.start));
        tick += 1
      ) {
        sim.step();
      }
      expect(getStickMan(sim).feet, way).toEqual(level3.start);
      expect(getAirplane(sim), way).toBeUndefined();
      expect(getItemSlots(sim), way).toEqual([
        { slot: 1, itemDefId: AIRPLANE_ITEM_ID, isSelected: true },
      ]);
      for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
        sim.step();
        expect(getLetter(sim), way).toBeUndefined();
        expect(getFallenItem(sim), way).toBeUndefined();
      }
    }
  });

  it('takes the letter the stick man was reading with it, and gives the stick man the airplane when the stick man dies while a new sheet of paper is on its way down', () => {
    const reading = createSimOnLevel3WithPaper();
    readLetter(reading);
    reading.startLevel(reading.level);
    expect(getLetter(reading)).toBeUndefined();

    const sim = createSimHoldingAirplane();
    WAYS_TO_LOSE_AIRPLANE_AND_LIVE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && !getFallenItem(sim); tick += 1) {
      sim.step();
    }
    expect(getFallenItem(sim)!.height).toBeGreaterThan(0);
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (
      let tick = 0;
      tick < 5 * TICK_RATE && !isSameSpot(getStickMan(sim).feet, level3.start);
      tick += 1
    ) {
      sim.step();
    }
    expect(getStickMan(sim).feet).toEqual(level3.start);
    expect(getLetter(sim)).toBeUndefined();
    expect(getFallenItem(sim)).toBeUndefined();
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, isSelected: true }]);
  });

  it('gives nothing to the stick man who has not read the letter: the stick man has not learned what to make', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    sim.startLevel(sim.level);
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    expect(getLetter(sim)).toMatchObject({ isBeingRead: false });
    expect(getFallenItem(sim)).toBeUndefined();
  });

  it("gives nothing more to the stick man who still has the paper or the airplane in the stick man's slot", () => {
    const withPaper = createSimOnLevel3WithPaper();
    readLetter(withPaper);
    withPaper.startLevel(withPaper.level);
    expect(getItemSlots(withPaper)).toEqual([
      { slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: true },
    ]);

    const withAirplane = createSimHoldingAirplane();
    withAirplane.startLevel(withAirplane.level);
    expect(getItemSlots(withAirplane)).toEqual([
      { slot: 1, itemDefId: AIRPLANE_ITEM_ID, isSelected: true },
    ]);
  });
});

describe('a new sheet of paper', () => {
  it("falls from the sky to where the stick man stands however the airplane is lost by the stick man who lives, and is picked up into the stick man's hand", () => {
    for (const [, lose] of WAYS_TO_LOSE_AIRPLANE_AND_LIVE) {
      const sim = createSimHoldingAirplane();
      lose(sim);
      for (let tick = 0; tick < 20 * TICK_RATE && hasAirplane(sim); tick += 1) {
        sim.step();
      }
      expect(hasAirplane(sim)).toBe(false);
      expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
      expect(getFallenItem(sim)).toBeUndefined();

      // Nothing at first, then a sheet high above the place, coming down, and at last lying there.
      // It is the paper, and no letter.
      for (let tick = 0; tick < TICK_RATE && !getFallenItem(sim); tick += 1) {
        sim.step();
      }
      const heights: number[] = [];
      // The stick man lost it at the edge, far from where the letter lay: the sheet comes to the
      // stick man.
      const stoodAt = getStickMan(sim).feet;
      expect(stoodAt.x).toBeGreaterThan(LETTER_AT.x + 3);
      for (
        let tick = 0;
        tick < 20 * TICK_RATE && (heights.length === 0 || getFallenItem(sim)!.height !== 0);
        tick += 1
      ) {
        const fallen = getFallenItem(sim)!;
        heights.push(fallen.height);
        expect(fallen).toMatchObject({ position: stoodAt, itemDefId: PAPER_ITEM_ID });
        expect(getLetter(sim)).toBeUndefined();
        sim.step();
      }
      expect(heights[0]).toBeGreaterThan(LETTER.fallsFromHeight - 1);
      expect(heights).toEqual([...heights].sort((one, other) => other - one));
      expect(getFallenItem(sim)!.height).toBe(0);

      // It lies at the stick man's feet. One press picks it up: nothing is read, and it is in the
      // stick man's hand, where the next press folds it.
      expect(getInteraction(sim)).toBe('pickUp');
      sim.step([INTERACT]);
      expect(getFallenItem(sim)).toBeUndefined();
      expect(getLetter(sim)).toBeUndefined();
      expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: true }]);
      expect(getInteraction(sim)).toBeNull();
      sim.step([USE_ITEM]);
      expect(getItemSlots(sim)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);

      // No further sheet comes while the stick man has it.
      for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
        sim.step();
        expect(getFallenItem(sim)).toBeUndefined();
      }
    }
  });

  it('does not fall for the stick man who has not read the letter: the letter lies there and gives the paper', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      sim.step();
      expect(getFallenItem(sim)).toBeUndefined();
    }
    expect(getLetter(sim)).toBeDefined();
  });

  it('is in the snapshot: restored on its way down, it lands and is picked up the same', () => {
    const sim = createSimHoldingAirplane();
    WAYS_TO_LOSE_AIRPLANE_AND_LIVE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && !getFallenItem(sim); tick += 1) {
      sim.step();
    }
    for (let tick = 0; tick < 20; tick += 1) {
      sim.step();
    }
    const restored = new Sim({ features, snapshot: sim.takeSnapshot() });
    expect(getFallenItem(restored)).toEqual(getFallenItem(sim));
    for (const each of [sim, restored]) {
      for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
        each.step();
      }
    }
    expect(restored.takeSnapshot()).toEqual(sim.takeSnapshot());
    expect(getFallenItem(restored)!.height).toBe(0);
  });

  it('does not fall once the flag is reached: the stick man who jumped out near the far side and lost the airplane needs none', () => {
    const sim = createSimHoldingAirplane();
    const snapshot = sim.takeSnapshot();
    const flagAt = level3.placements.find(
      (placement) => findLetterPlacedIn(level3) !== placement,
    )!.position;
    // Put next to the flag with nothing in the stick man's slot: the next tick reaches it.
    const atFlag = new Sim({
      features,
      snapshot: {
        ...snapshot,
        slices: {
          ...snapshot.slices,
          inventory: { slots: [null], selectedSlot: 1 },
          player: { ...(snapshot.slices.player as object), x: flagAt.x, y: flagAt.y },
        },
      },
    });
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      atFlag.step();
      expect(getFallenItem(atFlag)).toBeUndefined();
    }
    expect(hasAirplane(atFlag)).toBe(false);
  });

  it('cannot be picked up while it is still coming down, nor from out of reach once it lies there', () => {
    const sim = createSimHoldingAirplane();
    WAYS_TO_LOSE_AIRPLANE_AND_LIVE[0]![1](sim);
    for (let tick = 0; tick < 20 * TICK_RATE && !getFallenItem(sim); tick += 1) {
      sim.step();
    }
    for (let tick = 0; tick < 20 * TICK_RATE && getFallenItem(sim)!.height > 0; tick += 1) {
      expect(getInteraction(sim)).toBeNull();
      sim.step([INTERACT]);
      expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    }
    expect(getInteraction(sim)).toBe('pickUp');
    // It stays where it fell when the stick man walks away from it, and is out of reach from there.
    const fellAt = getFallenItem(sim)!.position;
    walkTo(sim, fellAt.x - LETTER.reach - 0.3);
    expect(getFallenItem(sim)).toMatchObject({ position: fellAt, height: 0 });
    expect(getInteraction(sim)).toBeNull();
    walkTo(sim, fellAt.x - LETTER.reach + 0.2);
    expect(getInteraction(sim)).toBe('pickUp');
  });

  it('waits for the stick man to land: one the stick man lost in the air gets its sheet where the stick man comes down, never over a gap', () => {
    const sim = createSimHoldingAirplane();
    for (const command of [USE_ITEM, INTERACT]) {
      sim.step([command]);
    }
    walkTo(sim, EDGE - 1);
    sim.step([{ type: 'player/jump' }]);
    for (let tick = 0; tick < 3; tick += 1) {
      sim.step();
    }
    // In the air the stick man puts nothing down: the stick man lands, and then sets it down past
    // the edge to lose it.
    for (let tick = 0; tick < TICK_RATE; tick += 1) {
      sim.step();
    }
    walkTo(sim, EDGE - 0.2);
    sim.step([INTERACT]);
    sim.step([{ type: 'player/jump' }]);
    let hasSeenStartMidAir = false;
    let ticksAirborneAfterDue = 0;
    for (let tick = 0; tick < 20 * TICK_RATE && !(getFallenItem(sim)?.height === 0); tick += 1) {
      const wasThere = getFallenItem(sim) !== undefined;
      sim.step(tick % 30 === 0 ? [{ type: 'player/jump' }] : []);
      const isAirborne = getStickMan(sim).action === 'jumping';
      // The tick it appears on, the stick man is on the floor.
      const hasAppearedMidAir = !wasThere && getFallenItem(sim) && isAirborne;
      if (hasAppearedMidAir) {
        hasSeenStartMidAir = true;
      }
      const isOverdueMidAir =
        !getFallenItem(sim) && isAirborne && tick > LETTER.fallsAfter * TICK_RATE + 2;
      if (isOverdueMidAir) {
        ticksAirborneAfterDue += 1;
      }
    }
    // It was due while the stick man was in a jump, and did wait.
    expect(ticksAirborneAfterDue).toBeGreaterThan(0);
    expect(hasSeenStartMidAir).toBe(false);
    const fellAt = getFallenItem(sim)!.position;
    expect(fellAt.y).toBe(0);
    expect(
      level3.floor.some((segment) => segment.start.x <= fellAt.x && fellAt.x <= segment.end.x),
    ).toBe(true);
  });

  it("does not fall while the airplane is anywhere: in the stick man's slot, on the floor or over its head", () => {
    const sim = createSimHoldingAirplane();
    const expectUntouched = (): void => {
      for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
        sim.step();
        expect(getFallenItem(sim)).toBeUndefined();
      }
    };
    expectUntouched();
    sim.step([USE_ITEM]);
    expectUntouched();
    sim.step([INTERACT]);
    expect(getAirplane(sim)!.state).toBe('carried');
    expectUntouched();
  });
});

describe('every letter', () => {
  it.each(letterDefs.map((def) => [def.name, def] as const))(
    '%s says something, teaches a recipe made from the item it gives',
    (_, def) => {
      expect(def.text.trim().length).toBeGreaterThan(0);
      expect(isItemDefId(def.gives)).toBe(true);
      expect(getRecipeDef(def.teachesRecipe)?.madeFrom).toBe(def.gives);
    },
  );

  it.each(levels.map((level) => [level.id, level] as const))(
    'level %i places at most one letter, over the floor',
    (_, level) => {
      const letters = level.placements.filter((placement) =>
        letterDefs.some((def) => def.id === placement.defId),
      );
      expect(letters.length).toBeLessThanOrEqual(1);
      const placed = findLetterPlacedIn(level);
      if (placed) {
        expect(
          level.floor.some(
            (segment) =>
              segment.start.x <= placed.position.x - LETTER.reach &&
              placed.position.x + LETTER.reach <= segment.end.x,
          ),
        ).toBe(true);
      }
    },
  );
});

describe('the letter about the spear, read with a hand that is full', () => {
  it.each([
    ['the paper', PAPER_ITEM_ID],
    ['a paper airplane', AIRPLANE_ITEM_ID],
  ])(
    'puts the pencil in the hand of the stick man that holds %s in its only slot, in place of it',
    (_name, heldItemDefId) => {
      const sim = new Sim({ features, start: { seed: 1, level: clubYard.id } });
      giveItem(sim, heldItemDefId);
      readSpearLetter(sim);
      expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PENCIL_ITEM_ID, isSelected: true }]);
      sim.step([INTERACT]);
      expect(getItemUse(sim)).toBe('craft');
      // Nothing falls from the sky afterwards: the stick man has what the letter was for.
      for (let tick = 0; tick < 5 * TICK_RATE; tick += 1) {
        sim.step();
      }
      expect(getFallenItem(sim)).toBeUndefined();
    },
  );

  it('gives the pencil to the stick man that has an airplane on the floor: only the letter about the airplane counts an airplane as what it was for', () => {
    const sim = new Sim({ features, start: { seed: 1, level: clubYard.id } });
    giveItem(sim, AIRPLANE_ITEM_ID);
    sim.step([{ type: 'inventory/select', slot: 1 }]);
    sim.step([USE_ITEM]);
    expect(hasAirplane(sim)).toBe(true);
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    readSpearLetter(sim);
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PENCIL_ITEM_ID, isSelected: true }]);
  });

  it('teaches the spear and names it', () => {
    const sim = new Sim({ features, start: { seed: 1, level: clubYard.id } });
    expect(getLetter(sim)).toMatchObject({ teaches: 'spear', isBeingRead: false });
    expect(letterDefs.find((def) => def.id === SPEAR_LETTER_ID)!.gives).toBe(PENCIL_ITEM_ID);
  });
});

// ---- Helpers ----

const LETTER_AT = findLetterPlacedIn(level3)!.position;
const EDGE = level3.floor[0]!.end.x;

const USE_ITEM: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/**
 * Every way there is to lose the airplane and stay alive, each as what the stick man does from the
 * moment it is an item in the stick man's selected slot.
 */
const WAYS_TO_LOSE_AIRPLANE_AND_LIVE: readonly (readonly [string, (sim: Sim) => void])[] = [
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

/**
 * Every way there is to die once the airplane is out of the stick man's slot, each as what the
 * stick man does from the moment it is an item in the stick man's selected slot.
 */
const WAYS_TO_DIE_WITHOUT_AIRPLANE: readonly (readonly [string, (sim: Sim) => void])[] = [
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
      expect(getAirplane(sim)!.state).toBe('flying');
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
      for (let tick = 0; tick < 20; tick += 1) {
        sim.step();
      }
      sim.step([{ type: 'player/jump' }]);
      expect(getStickMan(sim).action).toBe('jumping');
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

function isSameSpot(one: { x: number; y: number }, other: { x: number; y: number }): boolean {
  return one.x === other.x && one.y === other.y;
}

function createSimOnLevel3WithPaper(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 3 } });
  giveItem(sim, PAPER_ITEM_ID);
  return sim;
}

function readSpearLetter(sim: Sim): void {
  walkTo(sim, findLetterPlacedIn(clubYard)!.position.x);
  sim.step([INTERACT]);
  expect(getLetter(sim)!.isBeingRead).toBe(true);
}

function readLetter(sim: Sim): void {
  walkTo(sim, LETTER_AT.x);
  sim.step([INTERACT]);
  expect(getLetter(sim)!.isBeingRead).toBe(true);
}

/**
 * The stick man has read the letter, put it away and folded the paper: the airplane is the item in
 * the stick man's selected slot.
 */
function createSimHoldingAirplane(): Sim {
  const sim = createSimOnLevel3WithPaper();
  readLetter(sim);
  for (const command of [INTERACT, USE_ITEM]) {
    sim.step([command]);
  }
  expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, isSelected: true }]);
  return sim;
}

/** Walks the stick man to `x` and stops it there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > getStickMan(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - getStickMan(sim).feet.x) * direction > 0; tick += 1) {
    sim.step();
  }
  sim.step([{ type: 'player/walk', direction: 0 }]);
}
