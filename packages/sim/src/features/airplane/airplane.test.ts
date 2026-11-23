import { describe, expect, it } from 'vitest';
import { level3 } from '../../content/levels/level3';
import { STICK_MAN_HEIGHT } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { itemSlotsOf } from '../inventory/view';
import { itemUseOf } from '../item/view';
import { letterOf } from '../letter/view';
import { PLAYER } from '../player/defs';
import { stickManOf } from '../player/view';
import { interactionOf } from '../world/view';
import { AIRPLANE } from './defs';
import { __testing__, hasAirplane } from './index';
import { airplaneOf } from './view';

describe('placing the airplane', () => {
  it('puts it on the floor in front of him, the way he faces, and empties the slot', () => {
    const sim = holdingTheAirplane();
    sim.step([{ type: 'player/walk', direction: -1 }]);
    sim.step([{ type: 'player/walk', direction: 0 }]);
    const { feet } = stickManOf(sim);
    sim.step([USE_ITEM]);
    expect(airplaneOf(sim)).toEqual({ at: { x: feet.x - AIRPLANE.putDownAhead, y: 0 }, facing: -1, length: AIRPLANE.length, height: AIRPLANE.height, state: 'resting', verticalSpeed: 0, onAnEdge: false });
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: null, selected: true }]);
    expect(itemUseOf(sim)).toBeNull();
  });

  it('needs the airplane to be the selected item, and his feet on the floor', () => {
    const unselected = holdingTheAirplane();
    unselected.step([SELECT_SLOT_1]);
    unselected.step([USE_ITEM]);
    expect(airplaneOf(unselected)).toBeUndefined();

    const jumping = holdingTheAirplane();
    jumping.step([{ type: 'player/jump' }]);
    jumping.step([USE_ITEM]);
    expect(airplaneOf(jumping)).toBeUndefined();
    expect(itemSlotsOf(jumping)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
  });
});

describe('lifting, carrying and putting down', () => {
  it('lifts it only from within reach', () => {
    const sim = airplaneOnTheFloor();
    walkTo(sim, airplaneOf(sim)!.at.x - AIRPLANE.reach - 0.3);
    expect(interactionOf(sim)).toBeNull();
    sim.step([INTERACT]);
    expect(airplaneOf(sim)!.state).toBe('resting');
    walkTo(sim, airplaneOf(sim)!.at.x - AIRPLANE.reach + 0.2);
    sim.step([INTERACT]);
    expect(airplaneOf(sim)!.state).toBe('carried');
  });

  it('carries it over his head wherever he walks, turning with him', () => {
    const sim = carryingTheAirplane();
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < 30; tick += 1) {
      sim.step();
      const { feet } = stickManOf(sim);
      expect(airplaneOf(sim)).toMatchObject({ state: 'carried', facing: -1, at: { x: feet.x, y: feet.y - STICK_MAN_HEIGHT - AIRPLANE.carriedAbove } });
    }
    expect(stickManOf(sim)).toMatchObject({ action: 'walking', carrying: true });
  });

  it('puts it down in front of him and leaves his hands free', () => {
    const sim = carryingTheAirplane();
    const { feet } = stickManOf(sim);
    sim.step([INTERACT]);
    expect(airplaneOf(sim)).toMatchObject({ state: 'resting', at: { x: feet.x + AIRPLANE.putDownAhead, y: 0 }, onAnEdge: false });
    expect(stickManOf(sim).carrying).toBe(false);
    expect(interactionOf(sim)).toBe('lift');
  });

  it('is neither lifted nor put down while his feet are off the floor', () => {
    const sim = airplaneOnTheFloor();
    sim.step([{ type: 'player/jump' }]);
    sim.step([INTERACT]);
    expect(airplaneOf(sim)!.state).toBe('resting');

    const carrying = carryingTheAirplane();
    carrying.step([{ type: 'player/jump' }]);
    carrying.step([INTERACT]);
    expect(airplaneOf(carrying)!.state).toBe('carried');
  });

  it('shortens his jump while he carries it, by the tuning value', () => {
    expect(heightOfAJump(holdingTheAirplane())).toBeCloseTo(PLAYER.jumpHeight, 1);
    expect(heightOfAJump(carryingTheAirplane())).toBeCloseTo(PLAYER.jumpHeightCarrying, 1);
    expect(PLAYER.jumpHeightCarrying).toBeLessThanOrEqual(PLAYER.jumpHeight);
  });

  it('stays over his head through a jump on the floor', () => {
    const sim = carryingTheAirplane();
    sim.step([{ type: 'player/jump' }]);
    for (let tick = 0; tick < 60; tick += 1) sim.step();
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', carrying: true });
    expect(airplaneOf(sim)!.state).toBe('carried');
  });
});

describe('the edge', () => {
  it('lets it sit on the edge with its nose out when its middle has floor under it', () => {
    const sim = carryingTheAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - 0.2);
    sim.step([INTERACT]);
    const airplane = airplaneOf(sim)!;
    expect(airplane).toMatchObject({ state: 'resting', onAnEdge: true });
    expect(airplane.at.x).toBeCloseTo(stickManOf(sim).feet.x + AIRPLANE.putDownAhead, 6);
  });

  it('pulls it back onto the edge when it is put down a little past it', () => {
    const sim = carryingTheAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead + AIRPLANE.savedPastTheEdge / 2);
    sim.step([INTERACT]);
    expect(airplaneOf(sim)).toMatchObject({ state: 'resting', onAnEdge: true, at: { x: EDGE - AIRPLANE.sitsBackFromTheEdge, y: 0 } });
    for (let tick = 0; tick < 300; tick += 1) sim.step();
    expect(airplaneOf(sim)!.state).toBe('resting');
  });

  it('rests anywhere with floor under its middle, and nowhere further past an end than it is saved from', () => {
    const { whereItRests } = __testing__;
    const { floor } = level3;
    const right = (middle: number) => whereItRests(floor, { middle, facing: 1 });
    const left = (middle: number) => whereItRests(floor, { middle, facing: -1 });
    expect(right(5)).toBe(5);
    expect(right(EDGE)).toBe(EDGE);
    expect(right(EDGE + AIRPLANE.savedPastTheEdge)).toBe(EDGE - AIRPLANE.sitsBackFromTheEdge);
    expect(right(EDGE + AIRPLANE.savedPastTheEdge + 0.01)).toBeUndefined();
    expect(left(-AIRPLANE.savedPastTheEdge)).toBe(AIRPLANE.sitsBackFromTheEdge);
    expect(left(-AIRPLANE.savedPastTheEdge - 0.01)).toBeUndefined();
    expect(left(FAR_SIDE - 0.1)).toBe(FAR_SIDE + AIRPLANE.sitsBackFromTheEdge);
    // Never on to the far side of a gap: put down nose first just short of it, it falls.
    expect(right(FAR_SIDE - 0.1)).toBeUndefined();
    expect(left(EDGE + 0.1)).toBeUndefined();
  });

  it('is lifted, not boarded, where its nose sticks out past the end of the paper: there is nowhere to fly to', () => {
    const sim = holdingTheAirplane();
    walkTo(sim, AIRPLANE.putDownAhead + 0.2);
    sim.step([USE_ITEM]);
    const airplane = airplaneOf(sim)!;
    expect(airplane).toMatchObject({ state: 'resting', facing: -1, onAnEdge: false });
    expect(airplane.at.x - airplane.length / 2).toBeLessThan(0);
    expect(interactionOf(sim)).toBe('lift');
    sim.step([INTERACT]);
    expect(airplaneOf(sim)!.state).toBe('carried');
  });

  it('is boarded, not lifted, where it sits on an edge: the press is taken and, until boarding exists, does nothing', () => {
    const sim = carryingTheAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - 0.2);
    sim.step([INTERACT]);
    expect(interactionOf(sim)).toBe('board');
    const before = sim.snapshot().slices;
    sim.step([INTERACT]);
    expect(sim.snapshot().slices).toEqual(before);
  });
});

describe('losing the airplane', () => {
  it('falls and is lost when it is set down from the slot too far past the edge', () => {
    const sim = holdingTheAirplane();
    walkTo(sim, EDGE - 0.2);
    sim.step([USE_ITEM]);
    expectItToFallAndBeLost(sim);
    expect(stickManOf(sim).action).toBe('standing');
  });

  it('falls and is lost when he puts it down too far past the edge', () => {
    const sim = carryingTheAirplane();
    walkTo(sim, EDGE - 0.2);
    sim.step([INTERACT]);
    expect(stickManOf(sim).carrying).toBe(false);
    expectItToFallAndBeLost(sim);
  });

  it('falls out of his hands when he carries it off the edge, and is lost', () => {
    const sim = carryingTheAirplane();
    sim.step([{ type: 'player/walk', direction: 1 }]);
    let letGoWhileHeFell = false;
    for (let tick = 0; tick < 600 && hasAirplane(sim); tick += 1) {
      sim.step();
      const airplane = airplaneOf(sim);
      if (airplane?.state === 'falling') {
        letGoWhileHeFell = true;
        expect(stickManOf(sim).carrying).toBe(false);
        expect(airplane.at.x).toBeGreaterThan(EDGE);
      }
    }
    expect(letGoWhileHeFell).toBe(true);
    expect(hasAirplane(sim)).toBe(false);
  });

  it('falls out of his hands when he jumps into the gap with it', () => {
    const sim = carryingTheAirplane();
    walkTo(sim, EDGE - 0.3);
    sim.step([{ type: 'player/walk', direction: 1 }, { type: 'player/jump' }]);
    const states = new Set<string>();
    for (let tick = 0; tick < 600 && hasAirplane(sim); tick += 1) {
      sim.step();
      states.add(airplaneOf(sim)?.state ?? 'lost');
    }
    expect([...states]).toEqual(['carried', 'falling', 'lost']);
  });

  it('is lost when he dies while it rests on the floor: the level starts again without it', () => {
    const sim = airplaneOnTheFloor();
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < 600 && hasAirplane(sim); tick += 1) sim.step();
    expect(hasAirplane(sim)).toBe(false);
    expect(stickManOf(sim).feet).toEqual(level3.start);
  });

  it('is kept as an item when he dies with it in his slot', () => {
    const sim = holdingTheAirplane();
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < 300; tick += 1) sim.step();
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
    expect(letterOf(sim)).toBeUndefined();
  });
});

describe('the airplane in a snapshot', () => {
  it('is carried on by a restored sim exactly as by the one it was taken from', () => {
    const sim = carryingTheAirplane();
    const restored = new Sim({ features, snapshot: sim.snapshot() });
    for (const each of [sim, restored]) {
      each.step([{ type: 'player/walk', direction: 1 }]);
      for (let tick = 0; tick < 500; tick += 1) each.step();
    }
    expect(restored.snapshot()).toEqual(sim.snapshot());
  });
});

// ---- Helpers ----

const EDGE = level3.floor[0]!.to.x;
const FAR_SIDE = level3.floor[1]!.from.x;

const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };
const USE_ITEM: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/** On level 3, at the start, with the airplane item in the selected slot. */
function holdingTheAirplane(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 3 } });
  giveItem(sim, PAPER_ITEM_ID);
  walkTo(sim, letterOf(sim)!.at.x);
  // Read the letter, put it away, select the paper, open the recipes, fold.
  for (const command of [INTERACT, INTERACT, SELECT_SLOT_1, USE_ITEM, USE_ITEM]) sim.step([command]);
  expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
  return sim;
}

function airplaneOnTheFloor(): Sim {
  const sim = holdingTheAirplane();
  sim.step([USE_ITEM]);
  expect(airplaneOf(sim)!.state).toBe('resting');
  return sim;
}

function carryingTheAirplane(): Sim {
  const sim = airplaneOnTheFloor();
  sim.step([INTERACT]);
  expect(airplaneOf(sim)!.state).toBe('carried');
  return sim;
}

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > stickManOf(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - stickManOf(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}

function heightOfAJump(sim: Sim): number {
  sim.step([{ type: 'player/jump' }]);
  let highest = 0;
  for (let tick = 0; tick < 90; tick += 1) {
    sim.step();
    highest = Math.max(highest, -stickManOf(sim).feet.y);
  }
  return highest;
}

/** It is past the edge, falls further every tick, and then there is no airplane anywhere. */
function expectItToFallAndBeLost(sim: Sim): void {
  expect(airplaneOf(sim)).toMatchObject({ state: 'falling', onAnEdge: false });
  expect(airplaneOf(sim)!.at.x).toBeGreaterThan(EDGE);
  let previousY = airplaneOf(sim)!.at.y;
  for (let tick = 0; tick < 600 && airplaneOf(sim); tick += 1) {
    sim.step();
    const airplane = airplaneOf(sim);
    if (!airplane) break;
    expect(airplane.state).toBe('falling');
    expect(airplane.at.y).toBeGreaterThan(previousY);
    previousY = airplane.at.y;
  }
  expect(previousY).toBeGreaterThan(PLAYER.fallBelowFloor / 2);
  expect(hasAirplane(sim)).toBe(false);
}
