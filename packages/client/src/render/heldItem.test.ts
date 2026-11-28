import {
  createSim,
  getItemSlots,
  getSpear,
  getStickMan,
  PENCIL_ITEM_ID,
  practiceLevels,
  SPEAR_ITEM_ID,
  STICK_MAN_HEIGHT,
  type Command,
  type SimHandle,
} from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, buildHeldItemStrokes, getHeldItem, type HeldItem } from './heldItem';
import { convertToPixels } from './units';

const { SHAFT } = __testing__;

describe('the pencil in the hand of the stick man', () => {
  it('is held upright at its side like a staff: its blunt end off the floor, its other end at the top of its head, its hand on it', () => {
    const pencil = getHeldItemOf(createSimWithPencil());
    expect(pencil.isSharp).toBe(false);
    const feet = YARD.start;
    expect(pencil.butt.y).toBeLessThan(feet.y);
    expect(pencil.butt.y).toBeGreaterThan(feet.y - 0.4);
    expect(feet.y - pencil.tip.y).toBeGreaterThan(STICK_MAN_HEIGHT - 0.1);
    expect(measureDistanceToLine(pencil.hand!, pencil)).toBeCloseTo(0, 9);
    expect(measureLength(pencil)).toBeCloseTo(SHAFT.length, 9);
  });

  it('is on the side the stick man faces', () => {
    const sim = createSimWithPencil();
    const facingRight = getHeldItemOf(sim);
    expect(facingRight.hand!.x).toBeGreaterThan(getStickMan(sim).feet.x);
    sim.step([{ type: 'player/walk', direction: -1 }]);
    sim.step([{ type: 'player/walk', direction: 0 }]);
    const facingLeft = getHeldItemOf(sim);
    expect(facingLeft.hand!.x).toBeLessThan(getStickMan(sim).feet.x);
    expect(facingLeft.tip.x).toBeLessThan(facingLeft.butt.x);
  });

  it('is as long and as thick as the spear the sim makes of it', () => {
    const pencil = getHeldItemOf(createSimWithPencil());
    const spear = getHeldItemOf(createSimWithSpear());
    expect(measureLength(pencil)).toBeCloseTo(measureLength(spear), 9);
    expect(pencil.width).toBe(spear.width);
  });

  it('is drawn with flat ends, and the spear with a point at the end the sim has its point', () => {
    const pencil = getHeldItemOf(createSimWithPencil());
    const spear = getHeldItemOf(createSimWithSpear());
    expect(spear.isSharp).toBe(true);
    const tipOf = (item: HeldItem) => ({
      x: convertToPixels(item.tip.x),
      y: convertToPixels(item.tip.y),
    });
    const hasPointAt = (item: HeldItem): boolean =>
      buildHeldItemStrokes(item)[0]!.points.some(
        (point) => Math.hypot(point.x - tipOf(item).x, point.y - tipOf(item).y) < 1e-6,
      );
    expect(hasPointAt(spear)).toBe(true);
    expect(hasPointAt(pencil)).toBe(false);
    expect(buildHeldItemStrokes(spear).length).toBeGreaterThan(buildHeldItemStrokes(pencil).length);
  });

  it('is not drawn for any other item, nor for an empty hand', () => {
    const stickMan = getStickMan(createSim({ level: YARD.id }));
    expect(getHeldItem({ stickMan, itemDefId: null, spear: undefined })).toBeUndefined();
    expect(getHeldItem({ stickMan, itemDefId: 200, spear: undefined })).toBeUndefined();
  });
});

describe('the spear in a thrust', () => {
  it('is drawn along the line the sim tests while its point goes out: level, its point where the sim has it', () => {
    const sim = createSimWithSpear();
    sim.step([USE]);
    while (getSpear(sim)!.action === 'thrusting') {
      const spear = getSpear(sim)!;
      const drawn = getHeldItemOf(sim);
      expect(drawn.tip.x).toBeCloseTo(spear.tip.x, 9);
      expect(drawn.tip.y).toBeCloseTo(spear.tip.y, 9);
      expect(drawn.butt.x).toBeCloseTo(spear.butt.x, 9);
      expect(drawn.butt.y).toBeCloseTo(spear.butt.y, 9);
      expect(measureDistanceToLine(drawn.hand!, drawn)).toBeCloseTo(0, 9);
      sim.step();
    }
  });

  it('comes upright again as it is drawn back, never longer or shorter than it is, and ends as it is held at rest', () => {
    const sim = createSimWithSpear();
    const atRest = getHeldItemOf(sim);
    sim.step([USE]);
    while (getSpear(sim)!.action !== 'recovering') {
      sim.step();
    }
    const rises: number[] = [];
    while (getSpear(sim)!.action === 'recovering') {
      const drawn = getHeldItemOf(sim);
      expect(measureLength(drawn)).toBeCloseTo(SHAFT.length, 9);
      rises.push(drawn.butt.y - drawn.tip.y);
      sim.step();
    }
    expect(rises[0]).toBeCloseTo(0, 9);
    expect(rises).toEqual([...rises].sort((one, other) => one - other));
    expect(getHeldItemOf(sim)).toEqual(atRest);
  });

  it('lies on the floor once the stick man is struck down, off its hand', () => {
    const sim = createSimWithSpear();
    sim.step([{ type: 'player/walk', direction: 1 }]);
    while (getStickMan(sim).action !== 'struck') {
      sim.step();
    }
    const lying = getHeldItemOf(sim);
    expect(lying.hand).toBeNull();
    expect(lying.butt.y).toBe(lying.tip.y);
    expect(lying.butt.y).toBeLessThan(getStickMan(sim).feet.y);
    expect(getStickMan(sim).feet.y - lying.butt.y).toBeLessThan(0.2);
  });
});

// ---- Helpers ----

const YARD = practiceLevels.find((level) => level.id === 900)!;
const USE: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/** A sim in the yard with the letter read and put away: the pencil is in the stick man's hand. */
function createSimWithPencil(): SimHandle {
  const sim = createSim({ level: YARD.id });
  sim.step([{ type: 'player/walk', direction: 1 }]);
  while (getItemSlots(sim)[0]!.itemDefId !== PENCIL_ITEM_ID) {
    sim.step([INTERACT]);
  }
  sim.step([{ type: 'player/walk', direction: 0 }, INTERACT]);
  return sim;
}

function createSimWithSpear(): SimHandle {
  const sim = createSimWithPencil();
  sim.step([USE]);
  expect(getItemSlots(sim)[0]!.itemDefId).toBe(SPEAR_ITEM_ID);
  return sim;
}

function getHeldItemOf(sim: SimHandle): HeldItem {
  return getHeldItem({
    stickMan: getStickMan(sim),
    itemDefId: getItemSlots(sim).find((slot) => slot.isSelected)?.itemDefId ?? null,
    spear: getSpear(sim),
  })!;
}

function measureLength(item: HeldItem): number {
  return Math.hypot(item.tip.x - item.butt.x, item.tip.y - item.butt.y);
}

/** How far `point` is from the line through the ends of `item`. */
function measureDistanceToLine(point: { x: number; y: number }, item: HeldItem): number {
  const length = measureLength(item);
  return Math.abs(
    ((item.tip.x - item.butt.x) * (point.y - item.butt.y) -
      (item.tip.y - item.butt.y) * (point.x - item.butt.x)) /
      length,
  );
}
