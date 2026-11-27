import { describe, expect, it } from 'vitest';
import { level3 } from '../../content/levels/level3';
import { STICK_MAN_HEIGHT } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { getItemUse } from '../item/view';
import { getLetter } from '../letter/view';
import { PLAYER } from '../player/defs';
import { getStickMan } from '../player/view';
import { getInteraction } from '../world/view';
import { AIRPLANE, FLIGHT } from './defs';
import { __testing__, hasAirplane } from './index';
import { getAirplane, getFlyingHint } from './view';

describe('placing the airplane', () => {
  it('puts it on the floor in front of him, the way he faces, and empties the slot', () => {
    const sim = createSimHoldingAirplane();
    sim.step([{ type: 'player/walk', direction: -1 }]);
    sim.step([{ type: 'player/walk', direction: 0 }]);
    const { feet } = getStickMan(sim);
    sim.step([USE_ITEM]);
    expect(getAirplane(sim)).toEqual({ position: { x: feet.x - AIRPLANE.putDownAhead, y: 0 }, facing: -1, length: AIRPLANE.length, height: AIRPLANE.height, state: 'resting', verticalSpeed: 0, speed: 0, pitch: 0, stallSpeed: FLIGHT.stallSpeed, isOnEdge: false });
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: null, isSelected: true }]);
    expect(getItemUse(sim)).toBeNull();
  });

  it('needs the airplane to be the selected item, and his feet on the floor', () => {
    const unselected = createSimHoldingAirplane();
    unselected.step([SELECT_SLOT_1]);
    unselected.step([USE_ITEM]);
    expect(getAirplane(unselected)).toBeUndefined();

    const jumping = createSimHoldingAirplane();
    jumping.step([{ type: 'player/jump' }]);
    jumping.step([USE_ITEM]);
    expect(getAirplane(jumping)).toBeUndefined();
    expect(getItemSlots(jumping)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
  });
});

describe('lifting, carrying and putting down', () => {
  it('lifts it only from within reach', () => {
    const sim = createSimWithAirplaneOnFloor();
    // From the far side of it: on the near side lies the letter, which the same key reads.
    walkTo(sim, getAirplane(sim)!.position.x + AIRPLANE.reach + 0.3);
    expect(getInteraction(sim)).toBeNull();
    sim.step([INTERACT]);
    expect(getAirplane(sim)!.state).toBe('resting');
    walkTo(sim, getAirplane(sim)!.position.x + AIRPLANE.reach - 0.2);
    sim.step([INTERACT]);
    expect(getAirplane(sim)!.state).toBe('carried');
  });

  it('carries it over his head wherever he walks, turning with him', () => {
    const sim = createSimCarryingAirplane();
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < 30; tick += 1) {
      sim.step();
      const { feet } = getStickMan(sim);
      expect(getAirplane(sim)).toMatchObject({ state: 'carried', facing: -1, position: { x: feet.x, y: feet.y - STICK_MAN_HEIGHT - AIRPLANE.carriedAbove } });
    }
    expect(getStickMan(sim)).toMatchObject({ action: 'walking', isCarrying: true });
  });

  it('puts it down in front of him and leaves his hands free', () => {
    const sim = createSimCarryingAirplane();
    const { feet } = getStickMan(sim);
    sim.step([INTERACT]);
    expect(getAirplane(sim)).toMatchObject({ state: 'resting', position: { x: feet.x + AIRPLANE.putDownAhead, y: 0 }, isOnEdge: false });
    expect(getStickMan(sim).isCarrying).toBe(false);
    expect(getInteraction(sim)).toBe('lift');
  });

  it('is neither lifted nor put down while his feet are off the floor', () => {
    const sim = createSimWithAirplaneOnFloor();
    sim.step([{ type: 'player/jump' }]);
    sim.step([INTERACT]);
    expect(getAirplane(sim)!.state).toBe('resting');

    const carrying = createSimCarryingAirplane();
    carrying.step([{ type: 'player/jump' }]);
    carrying.step([INTERACT]);
    expect(getAirplane(carrying)!.state).toBe('carried');
  });

  it('shortens his jump while he carries it, by the tuning value', () => {
    expect(measureHeightOfJump(createSimHoldingAirplane())).toBeCloseTo(PLAYER.jumpHeight, 1);
    expect(measureHeightOfJump(createSimCarryingAirplane())).toBeCloseTo(PLAYER.jumpHeightCarrying, 1);
    expect(PLAYER.jumpHeightCarrying).toBeLessThanOrEqual(PLAYER.jumpHeight);
  });

  it('jumps with it as high as the movement tuning says, when that is tuned', () => {
    const sim = createSimCarryingAirplane();
    sim.step([{ type: 'player/tuneMovement', tuning: { jumpHeightCarrying: 1.5 } }]);
    expect(measureHeightOfJump(sim)).toBeCloseTo(1.5, 1);
  });

  it('stays over his head through a jump on the floor', () => {
    const sim = createSimCarryingAirplane();
    sim.step([{ type: 'player/jump' }]);
    for (let tick = 0; tick < 60; tick += 1) sim.step();
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', isCarrying: true });
    expect(getAirplane(sim)!.state).toBe('carried');
  });
});

describe('the edge', () => {
  it('lets it sit on the edge with its nose out when its middle has floor under it', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - 0.2);
    sim.step([INTERACT]);
    const airplane = getAirplane(sim)!;
    expect(airplane).toMatchObject({ state: 'resting', isOnEdge: true });
    expect(airplane.position.x).toBeCloseTo(getStickMan(sim).feet.x + AIRPLANE.putDownAhead, 6);
  });

  it('pulls it back onto the edge when it is put down a little past it', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead + AIRPLANE.edgeOverhangTolerance / 2);
    sim.step([INTERACT]);
    expect(getAirplane(sim)).toMatchObject({ state: 'resting', isOnEdge: true, position: { x: EDGE - AIRPLANE.edgeInset, y: 0 } });
    for (let tick = 0; tick < 300; tick += 1) sim.step();
    expect(getAirplane(sim)!.state).toBe('resting');
  });

  it('rests anywhere with floor under its middle, and nowhere further past an end than it is saved from', () => {
    const { findRestingPlace } = __testing__;
    const { floor } = level3;
    const findRestFacingRight = (middle: number) => findRestingPlace(floor, { middle, facing: 1 });
    const findRestFacingLeft = (middle: number) => findRestingPlace(floor, { middle, facing: -1 });
    expect(findRestFacingRight(5)).toBe(5);
    expect(findRestFacingRight(EDGE)).toBe(EDGE);
    expect(findRestFacingRight(EDGE + AIRPLANE.edgeOverhangTolerance)).toBe(EDGE - AIRPLANE.edgeInset);
    expect(findRestFacingRight(EDGE + AIRPLANE.edgeOverhangTolerance + 0.01)).toBeUndefined();
    expect(findRestFacingLeft(-AIRPLANE.edgeOverhangTolerance)).toBe(AIRPLANE.edgeInset);
    expect(findRestFacingLeft(-AIRPLANE.edgeOverhangTolerance - 0.01)).toBeUndefined();
    expect(findRestFacingLeft(FAR_SIDE - 0.1)).toBe(FAR_SIDE + AIRPLANE.edgeInset);
    // Never on to the far side of a gap: put down nose first just short of it, it falls.
    expect(findRestFacingRight(FAR_SIDE - 0.1)).toBeUndefined();
    expect(findRestFacingLeft(EDGE + 0.1)).toBeUndefined();
  });

  it('is lifted, not boarded, where its nose sticks out past the end of the paper: there is nowhere to fly to', () => {
    const sim = createSimHoldingAirplane();
    walkTo(sim, AIRPLANE.putDownAhead + 0.2);
    sim.step([USE_ITEM]);
    const airplane = getAirplane(sim)!;
    expect(airplane).toMatchObject({ state: 'resting', facing: -1, isOnEdge: false });
    expect(airplane.position.x - airplane.length / 2).toBeLessThan(0);
    expect(getInteraction(sim)).toBe('lift');
    sim.step([INTERACT]);
    expect(getAirplane(sim)!.state).toBe('carried');
  });

  it('is boarded, not lifted, where it sits on an edge (flight.test.ts has the flight)', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - 0.2);
    sim.step([INTERACT]);
    expect(getInteraction(sim)).toBe('board');
    sim.step([INTERACT]);
    expect(getStickMan(sim)).toMatchObject({ action: 'seated', isCarrying: false });
    expect(getAirplane(sim)!.state).toBe('flying');
  });
});

describe('losing the airplane', () => {
  it('falls and is lost when it is set down from the slot too far past the edge', () => {
    const sim = createSimHoldingAirplane();
    walkTo(sim, EDGE - 0.2);
    sim.step([USE_ITEM]);
    expectAirplaneToFallAndBeLost(sim);
    expect(getStickMan(sim).action).toBe('standing');
  });

  it('falls and is lost when he puts it down too far past the edge', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - 0.2);
    sim.step([INTERACT]);
    expect(getStickMan(sim).isCarrying).toBe(false);
    expectAirplaneToFallAndBeLost(sim);
  });

  it('falls out of his hands when he carries it off the edge: it is not carried down the gap with him', () => {
    const sim = createSimCarryingAirplane();
    sim.step([{ type: 'player/walk', direction: 1 }]);
    let hasLetGoDuringFall = false;
    for (let tick = 0; tick < 600 && getAirplane(sim); tick += 1) {
      sim.step();
      const airplane = getAirplane(sim);
      if (airplane?.state === 'falling') {
        hasLetGoDuringFall = true;
        expect(getStickMan(sim).isCarrying).toBe(false);
        expect(airplane.position.x).toBeGreaterThan(EDGE);
      }
    }
    expect(hasLetGoDuringFall).toBe(true);
    expect(getAirplane(sim)).toBeUndefined();
  });

  it('falls out of his hands when he jumps into the gap with it', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - 0.3);
    sim.step([{ type: 'player/walk', direction: 1 }, { type: 'player/jump' }]);
    const states = new Set<string>();
    for (let tick = 0; tick < 600 && getAirplane(sim); tick += 1) {
      sim.step();
      states.add(getAirplane(sim)?.state ?? 'lost');
    }
    expect([...states]).toEqual(['carried', 'falling', 'lost']);
  });

  it('is gone from the floor when he dies while it rests there: the level starts again with one in his hand instead', () => {
    const sim = createSimWithAirplaneOnFloor();
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < 600 && getAirplane(sim); tick += 1) sim.step();
    expect(getAirplane(sim)).toBeUndefined();
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, isSelected: true }]);
    expect(getStickMan(sim).feet).toEqual(level3.start);
  });

  it('is kept as an item when he dies with it in his slot', () => {
    const sim = createSimHoldingAirplane();
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < 300; tick += 1) sim.step();
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
    expect(getLetter(sim)).toBeUndefined();
  });
});

describe('that the airplane has to be taken to an edge', () => {
  it('is not said to him who has no airplane: before the letter, and with only the paper', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    expect(getFlyingHint(sim)).toBeNull();
    giveItem(sim, PAPER_ITEM_ID);
    expect(getFlyingHint(sim)).toBeNull();
  });

  it('is said from the moment he has one, in his slot, on the floor away from an edge or over his head', () => {
    const sim = createSimHoldingAirplane();
    expect(getFlyingHint(sim)).toBe('takeToEdge');
    sim.step([USE_ITEM]);
    expect(getAirplane(sim)).toMatchObject({ state: 'resting', isOnEdge: false });
    expect(getFlyingHint(sim)).toBe('takeToEdge');
    sim.step([INTERACT]);
    expect(getAirplane(sim)!.state).toBe('carried');
    expect(getFlyingHint(sim)).toBe('takeToEdge');
  });

  it('turns into its being ready the moment it sits on an edge, where the key boards it', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    expect(getFlyingHint(sim)).toBe('takeToEdge');
    sim.step([INTERACT]);
    expect(getAirplane(sim)).toMatchObject({ state: 'resting', isOnEdge: true });
    expect(getInteraction(sim)).toBe('board');
    expect(getFlyingHint(sim)).toBe('readyToBoard');
  });

  it('says it is ready for as long as it sits on the edge, him away from it included', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    sim.step([INTERACT]);
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.reach - 1);
    expect(getInteraction(sim)).toBeNull();
    expect(getFlyingHint(sim)).toBe('readyToBoard');
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    expect(getInteraction(sim)).toBe('board');
    expect(getFlyingHint(sim)).toBe('readyToBoard');
  });

  it('is not said to be ready once he has boarded it', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    sim.step([INTERACT]);
    expect(getFlyingHint(sim)).toBe('readyToBoard');
    sim.step([INTERACT]);
    expect(getStickMan(sim).action).toBe('seated');
    expect(getFlyingHint(sim)).toBeNull();
  });

  it('is not said from his boarding on, and is said again when the level starts again after a lost flight', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    sim.step([INTERACT]);
    sim.step([INTERACT]);
    expect(getStickMan(sim).action).toBe('seated');
    expect(getFlyingHint(sim)).toBeNull();
    for (let tick = 0; tick < 600 && !(getStickMan(sim).action === 'standing' && getStickMan(sim).feet.x === level3.start.x); tick += 1) sim.step();
    // The flight was lost: he is back at the start with an airplane in his hand, and is told again where it goes.
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(AIRPLANE_ITEM_ID);
    expect(getFlyingHint(sim)).toBe('takeToEdge');
  });

  it('is not said after a flight that crossed: he stands on the far side with the airplane beside him', () => {
    const sim = createSimCarryingAirplane();
    walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    sim.step([INTERACT]);
    sim.step([INTERACT, { type: 'airplane/steer', direction: 1 }]);
    for (let tick = 0; tick < CLIMB_TICKS_THAT_CROSS; tick += 1) sim.step();
    sim.step([{ type: 'airplane/steer', direction: 0 }]);
    for (let tick = 0; tick < 900 && getStickMan(sim).action === 'seated'; tick += 1) sim.step();
    expect(getStickMan(sim).feet.x).toBeGreaterThan(FAR_SIDE);
    expect(getAirplane(sim)!.state).toBe('resting');
    expect(getFlyingHint(sim)).toBeNull();
  });

  it('is not said on a level with no gap to fly over', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    giveItem(sim, AIRPLANE_ITEM_ID);
    expect(getFlyingHint(sim)).toBeNull();
  });
});

describe('the airplane in a snapshot', () => {
  it('is carried on by a restored sim exactly as by the one it was taken from', () => {
    const sim = createSimCarryingAirplane();
    const restored = new Sim({ features, snapshot: sim.takeSnapshot() });
    for (const each of [sim, restored]) {
      each.step([{ type: 'player/walk', direction: 1 }]);
      for (let tick = 0; tick < 500; tick += 1) each.step();
    }
    expect(restored.takeSnapshot()).toEqual(sim.takeSnapshot());
  });
});

// ---- Helpers ----

const EDGE = level3.floor[0]!.end.x;
const FAR_SIDE = level3.floor[1]!.start.x;
/** A climb of this many ticks from the boarding crosses level 3's gap: well inside the window `level3.test.ts` holds. */
const CLIMB_TICKS_THAT_CROSS = 28;

const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };
const USE_ITEM: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/** On level 3, at the start, with the airplane item in the selected slot. */
function createSimHoldingAirplane(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 3 } });
  giveItem(sim, PAPER_ITEM_ID);
  walkTo(sim, getLetter(sim)!.position.x);
  // Read the letter, which puts the paper in his hand, put it away, fold.
  for (const command of [INTERACT, INTERACT, USE_ITEM]) sim.step([command]);
  expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, isSelected: true }]);
  return sim;
}

function createSimWithAirplaneOnFloor(): Sim {
  const sim = createSimHoldingAirplane();
  sim.step([USE_ITEM]);
  expect(getAirplane(sim)!.state).toBe('resting');
  return sim;
}

function createSimCarryingAirplane(): Sim {
  const sim = createSimWithAirplaneOnFloor();
  sim.step([INTERACT]);
  expect(getAirplane(sim)!.state).toBe('carried');
  return sim;
}

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > getStickMan(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - getStickMan(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}

function measureHeightOfJump(sim: Sim): number {
  sim.step([{ type: 'player/jump' }]);
  let highest = 0;
  for (let tick = 0; tick < 90; tick += 1) {
    sim.step();
    highest = Math.max(highest, -getStickMan(sim).feet.y);
  }
  return highest;
}

/** It is past the edge, falls further every tick, and then there is no airplane anywhere. */
function expectAirplaneToFallAndBeLost(sim: Sim): void {
  expect(getAirplane(sim)).toMatchObject({ state: 'falling', isOnEdge: false });
  expect(getAirplane(sim)!.position.x).toBeGreaterThan(EDGE);
  let previousY = getAirplane(sim)!.position.y;
  for (let tick = 0; tick < 600 && getAirplane(sim); tick += 1) {
    sim.step();
    const airplane = getAirplane(sim);
    if (!airplane) break;
    expect(airplane.state).toBe('falling');
    expect(airplane.position.y).toBeGreaterThan(previousY);
    previousY = airplane.position.y;
  }
  expect(previousY).toBeGreaterThan(PLAYER.fallBelowFloor / 2);
  expect(hasAirplane(sim)).toBe(false);
}
