import {
  createSim,
  getEnemies,
  getStickMan,
  practiceLevels,
  type ClubEnemyView,
  type Command,
  type SimHandle,
} from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { buildClubEnemyStrokes } from './clubEnemy';
import type { Stroke } from './strokes';
import { __testing__, buildTornClubEnemyStrokes } from './tornClubEnemy';
import { convertToPixels } from './units';

const { cutStroke } = __testing__;

describe('the club enemy torn in two', () => {
  it('is drawn where it stood on the tick it is struck: nothing has moved yet but the tear across its mouth', () => {
    const [struck] = recordTornEnemy();
    const whole = getBounds(buildClubEnemyStrokes({ ...struck!, torn: null }, Number.NaN));
    const torn = getBounds(buildTornClubEnemyStrokes(struck!));
    // Its lower half has begun to come down, by less than it floats above the floor.
    // A tick of the tearing has gone by: within a few pixels.
    expect(Math.abs(torn.left - whole.left)).toBeLessThan(10);
    expect(Math.abs(torn.top - whole.top)).toBeLessThan(10);
    expect(torn.bottom - whole.bottom).toBeLessThan(convertToPixels(struck!.floatHeight));
  });

  it('has the same strokes in the same order for as long as it is there, so that none wobbles anew', () => {
    const counts = recordTornEnemy().map((enemy) => buildTornClubEnemyStrokes(enemy).length);
    expect(new Set(counts).size).toBe(1);
  });

  it('comes down as it tears and puts nothing through the floor line, while it tears and while it lies', () => {
    const onSheet = recordTornEnemy().filter((enemy) => enemy.torn!.action !== 'leaving');
    const floor = convertToPixels(onSheet[0]!.position.y + onSheet[0]!.floatHeight);
    for (const enemy of onSheet) {
      expect(getBounds(buildTornClubEnemyStrokes(enemy)).bottom).toBeLessThanOrEqual(floor + 1e-6);
    }
    const tops = onSheet
      .filter((enemy) => enemy.torn!.action === 'tearing')
      .map((enemy) => getBounds(buildTornClubEnemyStrokes(enemy)).top);
    expect(tops.at(-1)).toBeGreaterThan(tops[0]!);
  });

  it('lies still: every frame of the lying is the frame the tearing ended on', () => {
    const lying = recordTornEnemy().filter((enemy) => enemy.torn!.action === 'lying');
    const first = buildTornClubEnemyStrokes(lying[0]!);
    expect(lying.length).toBeGreaterThan(10);
    for (const enemy of lying) {
      expect(buildTornClubEnemyStrokes(enemy)).toEqual(first);
    }
    // Lower than it stood, and wider: its upper half lies beside it, the club in front.
    const whole = getBounds(buildClubEnemyStrokes({ ...lying[0]!, torn: null }, Number.NaN));
    const lain = getBounds(first);
    expect(lain.top).toBeGreaterThan(whole.top);
    expect(lain.right - lain.left).toBeGreaterThan(whole.right - whole.left);
  });

  it('leaves the sheet away from the stick man and upwards, and is out of the widest view before the sim has it gone', () => {
    const leaving = recordTornEnemy().filter((enemy) => enemy.torn!.action === 'leaving');
    const stoodAt = convertToPixels(leaving[0]!.position.x);
    const floor = convertToPixels(leaving[0]!.position.y);
    const last = getBounds(buildTornClubEnemyStrokes(leaving.at(-1)!));
    // The stick man came from the left: away is to the right. The widest view is 30 m across.
    expect(last.left - stoodAt).toBeGreaterThan(convertToPixels(WIDEST_VIEW));
    expect(floor - last.bottom).toBeGreaterThan(convertToPixels(4));
    // Taken together they go that way and on once the wind has them: a scrap turns over, the lot
    // of them does not come back.
    const middles = leaving.map((enemy) => {
      const points = buildTornClubEnemyStrokes(enemy).flatMap((stroke) => stroke.points);
      return points.reduce((sum, point) => sum + point.x, 0) / points.length;
    });
    const everyTenth = middles.filter(
      (_, index) => index % 10 === 0 && index >= middles.length / 4,
    );
    expect(everyTenth).toEqual([...everyTenth].sort((one, other) => one - other));
  });

  it('is picked up a scrap at a time: early in the leaving something has moved and something still lies there', () => {
    const torn = recordTornEnemy();
    const lying = buildTornClubEnemyStrokes(torn.find((enemy) => enemy.torn!.action === 'lying')!);
    const early = torn.find(
      (enemy) => enemy.torn!.action === 'leaving' && enemy.torn!.progress > 0.1,
    )!;
    const strokes = buildTornClubEnemyStrokes(early);
    const moved = strokes.filter((stroke, index) => !areSameStrokes(stroke, lying[index]!));
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.length).toBeLessThan(strokes.length);
  });
});

describe('cutting a stroke at a level line', () => {
  it('keeps the part on the side asked for, ending on the line', () => {
    const line: Stroke = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      thickness: 2,
    };
    expect(cutStroke(line, 4, 'above')).toEqual([
      {
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 4 },
        ],
        thickness: 2,
      },
    ]);
    expect(cutStroke(line, 4, 'below')[0]!.points).toEqual([
      { x: 4, y: 4 },
      { x: 10, y: 10 },
    ]);
  });

  it('cuts a loop open into the pieces on that side, and gives nothing for a stroke wholly on the other', () => {
    const square: Stroke = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      thickness: 2,
      isClosed: true,
    };
    const below = cutStroke(square, 5, 'below');
    expect(below).toHaveLength(1);
    expect(below[0]!.points).toEqual([
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
    ]);
    expect(below[0]!.isClosed).toBeUndefined();
    expect(cutStroke(square, 20, 'below')).toEqual([]);
  });
});

// ---- Helpers ----

const YARD = practiceLevels[0]!;
const USE: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };
/** The most metres across the level's camera ever shows (`FRAMING.mostMetresAcross`), and more. */
const WIDEST_VIEW = 15;

/** The enemy of the yard on every tick from the thrust that tears it until it is gone. */
function recordTornEnemy(): ClubEnemyView[] {
  const sim = createSimWithSpear();
  sim.step([{ type: 'player/walk', direction: 1 }]);
  while (getEnemies(sim)[0]!.position.x - getStickMan(sim).feet.x > 2.3) {
    sim.step();
  }
  sim.step([{ type: 'player/walk', direction: 0 }, USE]);
  const seen: ClubEnemyView[] = [];
  for (let tick = 0; tick < 600 && getEnemies(sim).length > 0; tick += 1) {
    const enemy = getEnemies(sim)[0]!;
    if (enemy.torn) {
      seen.push(enemy);
    }
    sim.step();
  }
  expect(getEnemies(sim)).toEqual([]);
  return seen;
}

function createSimWithSpear(): SimHandle {
  const sim = createSim({ level: YARD.id });
  sim.step([{ type: 'player/walk', direction: 1 }]);
  for (let tick = 0; tick < 600 && getStickMan(sim).feet.x < 4.8; tick += 1) {
    sim.step();
  }
  sim.step([{ type: 'player/walk', direction: 0 }, INTERACT]);
  sim.step([INTERACT]);
  sim.step([USE]);
  return sim;
}

function getBounds(strokes: readonly Stroke[]) {
  const points = strokes.flatMap((stroke) => stroke.points);
  return {
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}

function areSameStrokes(one: Stroke, other: Stroke): boolean {
  return JSON.stringify(one.points) === JSON.stringify(other.points);
}
