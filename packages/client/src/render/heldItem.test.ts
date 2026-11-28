import {
  createSim,
  getItemSlots,
  getSpear,
  getStickMan,
  practiceLevels,
  SPEAR_ITEM_ID,
  STICK_MAN_HEIGHT,
  type Command,
  type SimHandle,
} from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, buildHeldSpearStrokes, getHeldSpear, type HeldSpear } from './heldItem';
import { convertToPixels } from './units';

const { ROLL } = __testing__;

describe('the spear in the hand of the stick man', () => {
  it('is held upright at its side like a staff: its wide end off the floor, its point at the top of its head, its hand on it', () => {
    const sim = createSimWithSpear();
    const spear = getHeldSpearOf(sim)!;
    const { feet } = getStickMan(sim);
    expect(spear.butt.y).toBeLessThan(feet.y);
    expect(spear.butt.y).toBeGreaterThan(feet.y - 0.4);
    expect(feet.y - spear.tip.y).toBeGreaterThan(STICK_MAN_HEIGHT - 0.1);
    expect(measureDistanceToLine(spear.hand!, spear)).toBeCloseTo(0, 9);
    expect(measureLength(spear)).toBeCloseTo(measureLength(getSpear(sim)!), 9);
  });

  it('is on the side the stick man faces', () => {
    const sim = createSimWithSpear();
    expect(getHeldSpearOf(sim)!.hand!.x).toBeGreaterThan(getStickMan(sim).feet.x);
    sim.step([{ type: 'player/walk', direction: -1 }]);
    sim.step([{ type: 'player/walk', direction: 0 }]);
    const facingLeft = getHeldSpearOf(sim)!;
    expect(facingLeft.hand!.x).toBeLessThan(getStickMan(sim).feet.x);
    expect(facingLeft.tip.x).toBeLessThan(facingLeft.butt.x);
  });

  it('is drawn as a roll of paper: wide at the end it is held by, a point where the sim has its point, the edge of the sheet winding round it', () => {
    const spear = getHeldSpearOf(createSimWithSpear())!;
    const [outline, ...windings] = buildHeldSpearStrokes(spear);
    const tip = { x: convertToPixels(spear.tip.x), y: convertToPixels(spear.tip.y) };
    const butt = { x: convertToPixels(spear.butt.x), y: convertToPixels(spear.butt.y) };
    expect(outline!.isClosed).toBe(true);
    expect(outline!.points).toHaveLength(3);
    expect(outline!.points[1]!.x).toBeCloseTo(tip.x, 6);
    expect(outline!.points[1]!.y).toBeCloseTo(tip.y, 6);
    const [oneCorner, , otherCorner] = outline!.points;
    expect(Math.hypot(oneCorner!.x - otherCorner!.x, oneCorner!.y - otherCorner!.y)).toBeCloseTo(
      convertToPixels(ROLL.width),
      6,
    );
    expect((oneCorner!.x + otherCorner!.x) / 2).toBeCloseTo(butt.x, 6);
    expect(windings).toHaveLength(ROLL.windings.length);
  });

  it('is not drawn for the paper it is made of, nor for an empty hand', () => {
    const sim = createSimWithPaper();
    expect(getSpear(sim)).toBeUndefined();
    expect(getHeldSpearOf(sim)).toBeUndefined();
    expect(getHeldSpearOf(createSim({ level: YARD.id }))).toBeUndefined();
  });
});

describe('the spear in a thrust', () => {
  it('is drawn along the line the sim tests while its point goes out: level, its point where the sim has it', () => {
    const sim = createSimWithSpear();
    sim.step([USE]);
    while (getSpear(sim)!.action === 'thrusting') {
      const spear = getSpear(sim)!;
      const drawn = getHeldSpearOf(sim)!;
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
    const atRest = getHeldSpearOf(sim)!;
    sim.step([USE]);
    while (getSpear(sim)!.action !== 'recovering') {
      sim.step();
    }
    const rises: number[] = [];
    while (getSpear(sim)!.action === 'recovering') {
      const drawn = getHeldSpearOf(sim)!;
      expect(measureLength(drawn)).toBeCloseTo(measureLength(atRest), 9);
      rises.push(drawn.butt.y - drawn.tip.y);
      sim.step();
    }
    expect(rises[0]).toBeCloseTo(0, 9);
    expect(rises).toEqual([...rises].sort((one, other) => one - other));
    expect(getHeldSpearOf(sim)).toEqual(atRest);
  });

  it('lies on the floor once the stick man is struck down, off its hand, its lower edge on the line', () => {
    const sim = createSimWithSpear();
    sim.step([{ type: 'player/walk', direction: 1 }]);
    while (getStickMan(sim).action !== 'struck') {
      sim.step();
    }
    const lying = getHeldSpearOf(sim)!;
    expect(lying.hand).toBeNull();
    expect(lying.butt.y).toBe(lying.tip.y);
    const floor = convertToPixels(getStickMan(sim).feet.y);
    const lowest = Math.max(
      ...buildHeldSpearStrokes(lying).flatMap((stroke) => stroke.points.map((point) => point.y)),
    );
    expect(lowest).toBeLessThan(floor);
    expect(floor - lowest).toBeLessThan(convertToPixels(0.1));
  });
});

// ---- Helpers ----

const YARD = practiceLevels[0]!;
const USE: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/** A sim in the yard with the letter read and put away: the paper is in the stick man's hand. */
function createSimWithPaper(): SimHandle {
  const sim = createSim({ level: YARD.id });
  sim.step([{ type: 'player/walk', direction: 1 }]);
  while (getItemSlots(sim)[0]!.itemDefId === null) {
    sim.step([INTERACT]);
  }
  sim.step([{ type: 'player/walk', direction: 0 }, INTERACT]);
  return sim;
}

function createSimWithSpear(): SimHandle {
  const sim = createSimWithPaper();
  sim.step([USE]);
  expect(getItemSlots(sim)[0]!.itemDefId).toBe(SPEAR_ITEM_ID);
  return sim;
}

function getHeldSpearOf(sim: SimHandle): HeldSpear | undefined {
  return getHeldSpear(getStickMan(sim), getSpear(sim));
}

function measureLength(line: { butt: { x: number; y: number }; tip: { x: number; y: number } }) {
  return Math.hypot(line.tip.x - line.butt.x, line.tip.y - line.butt.y);
}

/** How far `point` is from the line through the ends of `spear`. */
function measureDistanceToLine(point: { x: number; y: number }, spear: HeldSpear): number {
  return Math.abs(
    ((spear.tip.x - spear.butt.x) * (point.y - spear.butt.y) -
      (spear.tip.y - spear.butt.y) * (point.x - spear.butt.x)) /
      measureLength(spear),
  );
}
