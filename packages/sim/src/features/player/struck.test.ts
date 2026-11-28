import { describe, expect, it } from 'vitest';
import { getLevelById } from '../../content/levels';
import { level3 } from '../../content/levels/level3';
import { STICK_MAN_HEIGHT, STICK_MAN_WIDTH } from '../../content/tuning';
import type { Blow, Box } from '../../core/blow';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { AIRPLANE } from '../airplane/defs';
import { getAirplane } from '../airplane/view';
import { getFlag } from '../flag/view';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { getItemUse } from '../item/view';
import { getLetter } from '../letter/view';
import { getInteraction } from '../world/view';
import {
  getPlayerBody,
  getPlayerBox,
  isPlayerStruck,
  keepPlayerOutOfBox,
  strikePlayerWith,
} from './body';
import { PLAYER } from './defs';
import { getStickMan } from './view';

describe('a blow at the stick man', () => {
  it('strikes the stick man it touches: struck from that tick, knocked the way the blow says', () => {
    const sim = createSimOn(1);
    expect(strikePlayerWith(sim, makeBlowAcross(sim, { direction: -1 }))).toBe(true);
    expect(isPlayerStruck(sim)).toBe(true);
    expect(getStickMan(sim)).toMatchObject({
      action: 'struck',
      struckFor: 0,
      struckDirection: -1,
      feet: LEVEL_1.start,
    });
  });

  it('misses the stick man it does not touch, and nothing happens', () => {
    const sim = createSimOn(1);
    const { x, y } = getPlayerBody(sim);
    const overHead: Blow = {
      start: { x: x - 1, y: y - STICK_MAN_HEIGHT - 0.2 },
      end: { x: x + 1, y: y - STICK_MAN_HEIGHT - 0.2 },
      thickness: 0.2,
      direction: 1,
    };
    const beside: Blow = {
      start: { x: x + STICK_MAN_WIDTH / 2 + 0.2, y: y - 2 },
      end: { x: x + STICK_MAN_WIDTH / 2 + 0.2, y },
      thickness: 0.2,
      direction: 1,
    };
    expect(strikePlayerWith(sim, overHead)).toBe(false);
    expect(strikePlayerWith(sim, beside)).toBe(false);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', struckFor: null });
  });

  it("is tested against a box as wide and as tall as the stick man, standing on the stick man's feet", () => {
    const sim = createSimOn(1);
    const { x, y } = LEVEL_1.start;
    expect(getPlayerBox(sim)).toEqual({
      left: x - STICK_MAN_WIDTH / 2,
      right: x + STICK_MAN_WIDTH / 2,
      top: y - STICK_MAN_HEIGHT,
      bottom: y,
    });
  });

  it('does not strike twice: the stick man that is down stays as the first blow left it', () => {
    const sim = createSimOn(1);
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: -1 }));
    stepFor(sim, 10);
    expect(strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }))).toBe(false);
    expect(getStickMan(sim)).toMatchObject({ struckDirection: -1 });
    expect(getStickMan(sim).struckFor).toBeCloseTo(10 * sim.dt, 6);
  });

  it('does not strike the stick man under the flag it has reached: a finished level is not taken back', () => {
    const sim = createSimOn(1);
    walkUntil(sim, () => getFlag(sim)!.isReached);
    expect(strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }))).toBe(false);
    expect(getStickMan(sim).action).toBe('cheering');
  });
});

describe('the stick man struck down', () => {
  it('lies where it was struck and hears no key, until the level starts again after the pause', () => {
    const sim = createSimOn(1);
    stepFor(sim, 40, [WALK_RIGHT]);
    const struckAt = getStickMan(sim).feet;
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }));
    const pauseTicks = Math.round(PLAYER.struckPause / sim.dt);
    for (let tick = 0; tick < pauseTicks - 1; tick += 1) {
      sim.step(tick % 7 === 0 ? [WALK_LEFT, JUMP, USE_ITEM, INTERACT] : [WALK_RIGHT]);
      expect(getStickMan(sim)).toMatchObject({
        action: 'struck',
        feet: struckAt,
        horizontalSpeed: 0,
        verticalSpeed: 0,
      });
    }
    sim.step();
    expect(getStickMan(sim)).toMatchObject({
      action: 'standing',
      feet: LEVEL_1.start,
      struckFor: null,
    });
    expect(sim.level).toBe(1);
  });

  it('falls straight down to the floor when it is struck in a jump, and lies there', () => {
    const sim = createSimOn(1);
    stepFor(sim, 12, [WALK_RIGHT, JUMP]);
    const struckAt = getStickMan(sim);
    expect(struckAt.verticalSpeed).toBeLessThan(0);
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }));
    sim.step();
    expect(getStickMan(sim).verticalSpeed).toBeGreaterThan(0);
    stepFor(sim, 40);
    expect(getStickMan(sim)).toMatchObject({
      action: 'struck',
      feet: { x: struckAt.feet.x, y: 0 },
      verticalSpeed: 0,
    });
  });

  it('starts the level again at once when it falls off the paper instead of onto the floor', () => {
    const sim = createSimOn(2);
    const gapStart = getLevelById(2).floor[0]!.end.x;
    walkUntil(sim, () => getStickMan(sim).feet.x > gapStart + STICK_MAN_WIDTH);
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }));
    let ticks = 0;
    while (isPlayerStruck(sim)) {
      sim.step();
      ticks += 1;
      expect(ticks).toBeLessThan(600);
    }
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: getLevelById(2).start });
  });

  it('does not reach a flag it is struck down next to', () => {
    const sim = createSimOn(1);
    const flag = getFlag(sim)!;
    walkUntil(sim, () => getStickMan(sim).feet.x > flag.position.x - 0.6);
    expect(flag.isReached).toBe(false);
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }));
    // Knocked no further: it lies short of the flag. Put right next to it, it still does not
    // reach it.
    stepFor(sim, 30);
    expect(getFlag(sim)!.isReached).toBe(false);
  });

  it('does nothing with either action key, and selects no slot', () => {
    const sim = createSimOn(3);
    giveItem(sim, PAPER_ITEM_ID);
    walkUntil(sim, () => getInteraction(sim) === 'read');
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }));
    expect(getInteraction(sim)).toBeNull();
    expect(getItemUse(sim)).toBeNull();
    stepFor(sim, 5, [INTERACT, USE_ITEM, { type: 'inventory/select', slot: 1 }]);
    expect(getLetter(sim)).toMatchObject({ isBeingRead: false });
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: false }]);
  });

  it('puts away the letter it was reading', () => {
    const sim = createSimOn(3);
    giveItem(sim, PAPER_ITEM_ID);
    walkUntil(sim, () => getInteraction(sim) === 'read');
    sim.step([INTERACT]);
    expect(getLetter(sim)!.isBeingRead).toBe(true);
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }));
    sim.step();
    expect(getLetter(sim)).toBeUndefined();
  });

  it('lets go of the airplane it carried, which comes down on the floor', () => {
    const sim = createSimCarryingAirplane();
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }));
    sim.step();
    expect(getAirplane(sim)!.state).toBe('falling');
    expect(getStickMan(sim).isCarrying).toBe(false);
    stepFor(sim, 60);
    expect(getAirplane(sim)).toMatchObject({ state: 'resting', position: { y: 0 } });
  });

  it('is knocked out of the airplane it flew in: it falls from its seat, and the airplane falls on without it', () => {
    const sim = createSimCarryingAirplane();
    const edge = level3.floor[0]!.end.x;
    walkUntil(sim, () => getStickMan(sim).feet.x >= edge - AIRPLANE.putDownAhead - 0.2);
    sim.step([STOP]);
    sim.step([INTERACT]);
    sim.step([INTERACT]);
    expect(getStickMan(sim).action).toBe('seated');
    stepFor(sim, 20);
    strikePlayerWith(sim, makeBlowAcross(sim, { direction: 1 }));
    expect(getStickMan(sim)).toMatchObject({ action: 'struck' });
    sim.step();
    expect(getAirplane(sim)!.state).toBe('falling');
    const fallingFrom = getStickMan(sim).feet.y;
    sim.step();
    expect(getStickMan(sim).feet.y).toBeGreaterThan(fallingFrom);
  });
});

describe('something solid in the way of the stick man', () => {
  it('stops the stick man that walks into it, half its width away, on the side it came from', () => {
    const sim = createSimOn(1);
    const box = makeBoxAhead(sim, { distance: 1, height: 1.3 });
    sim.step([WALK_RIGHT]);
    for (let tick = 0; tick < 120; tick += 1) {
      sim.step();
      keepPlayerOutOfBox(sim, box);
    }
    expect(getPlayerBody(sim).x).toBeCloseTo(box.left - STICK_MAN_WIDTH / 2, 9);
    expect(isPlayerStruck(sim)).toBe(false);
  });

  it('leaves alone the stick man beside it, over it and under it', () => {
    const sim = createSimOn(1);
    const { x, y } = getPlayerBody(sim);
    const beside: Box = { left: x + 0.4, right: x + 1.2, top: y - 1, bottom: y };
    const below: Box = { left: x - 1, right: x + 1, top: y, bottom: y + 1 };
    const above: Box = { left: x - 1, right: x + 1, top: y - 3, bottom: y - STICK_MAN_HEIGHT };
    for (const box of [beside, below, above]) {
      keepPlayerOutOfBox(sim, box);
      expect(getPlayerBody(sim).x).toBe(x);
    }
  });

  it("pushes the stick man in the air aside by its outline: a point at the stick man's feet, its full width higher up", () => {
    const sim = createSimOn(1);
    const { x, y } = getPlayerBody(sim);
    // The top of the box is just above its feet: only the point of them is in it.
    const shallow = 0.1;
    keepPlayerOutOfBox(sim, { left: x - 0.2, right: x + 1, top: y - shallow, bottom: y + 1 });
    expect(getPlayerBody(sim).x).toBeCloseTo(
      x - 0.2 - (STICK_MAN_WIDTH / 2) * (shallow / PLAYER.fullWidthAbove),
      9,
    );
  });

  it('moves the stick man out on the side its middle is on', () => {
    const sim = createSimOn(1);
    const { x, y } = getPlayerBody(sim);
    keepPlayerOutOfBox(sim, { left: x - 1, right: x + 0.3, top: y - 1, bottom: y });
    expect(getPlayerBody(sim).x).toBeCloseTo(x + 0.3 + STICK_MAN_WIDTH / 2, 9);
  });
});

// ---- Helpers ----

const LEVEL_1 = getLevelById(1);
const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };
const WALK_LEFT: Command = { type: 'player/walk', direction: -1 };
const STOP: Command = { type: 'player/walk', direction: 0 };
const JUMP: Command = { type: 'player/jump' };
const USE_ITEM: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

function createSimOn(level: number): Sim {
  return new Sim({ features, start: { seed: 1, level } });
}

function stepFor(sim: Sim, ticks: number, commands: readonly Command[] = []): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    sim.step(tick === 0 ? commands : []);
  }
}

function walkUntil(sim: Sim, isDone: () => boolean): void {
  sim.step([WALK_RIGHT]);
  for (let tick = 0; !isDone(); tick += 1) {
    sim.step();
    if (tick > 3000) {
      throw new Error('never got there');
    }
  }
}

/** A blow through the middle of the stick man where it is now, from one side to the other. */
function makeBlowAcross(sim: Sim, blow: { direction: 1 | -1 }): Blow {
  const { x, y } = getPlayerBody(sim);
  return {
    start: { x: x - 1, y: y - STICK_MAN_HEIGHT / 2 },
    end: { x: x + 1, y: y - STICK_MAN_HEIGHT / 2 },
    thickness: 0.2,
    direction: blow.direction,
  };
}

/** A box on the floor whose near side is `distance` in front of the stick man. */
function makeBoxAhead(sim: Sim, box: { distance: number; height: number }): Box {
  const { x, y } = getPlayerBody(sim);
  return { left: x + box.distance, right: x + box.distance + 0.8, top: y - box.height, bottom: y };
}

/** On level 3 with the airplane folded, put down and lifted over the stick man's head. */
function createSimCarryingAirplane(): Sim {
  const sim = createSimOn(3);
  giveItem(sim, PAPER_ITEM_ID);
  walkUntil(sim, () => getInteraction(sim) === 'read');
  sim.step([STOP]);
  for (const command of [INTERACT, INTERACT, USE_ITEM, USE_ITEM, INTERACT]) {
    sim.step([command]);
  }
  expect(getItemSlots(sim)[0]!.itemDefId).not.toBe(AIRPLANE_ITEM_ID);
  expect(getAirplane(sim)!.state).toBe('carried');
  return sim;
}
