import { STICK_MAN_HEIGHT } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, stickManStrokes, walkCycleLength, type StickManPose } from './stickMan';
import { toPixels } from './units';

const { skeletonOf, BODY } = __testing__;

describe('the stick man standing', () => {
  it('is a head, a body, two arms and two legs', () => {
    const strokes = stickManStrokes(STANDING);
    expect(strokes).toHaveLength(6);
    expect(strokes.filter((stroke) => stroke.closed)).toHaveLength(1);
    expect(strokes.filter((stroke) => !stroke.closed).map((stroke) => stroke.points.length)).toEqual([2, 3, 3, 3, 3]);
  });

  it('has his feet on the floor and is as tall as the sim says he is', () => {
    const skeleton = skeletonOf(STANDING);
    for (const leg of skeleton.legs) expect(leg[2]!.y).toBeCloseTo(STANDING.feet.y, 6);
    const height = STANDING.feet.y - (skeleton.head.y - BODY.headRadius);
    expect(height).toBeGreaterThan(STICK_MAN_HEIGHT * 0.95);
    expect(height).toBeLessThanOrEqual(STICK_MAN_HEIGHT);
  });

  it('is drawn in world pixels, where his feet are', () => {
    const points = stickManStrokes(STANDING).flatMap((stroke) => stroke.points);
    expect(Math.max(...points.map((point) => point.y))).toBeCloseTo(toPixels(STANDING.feet.y), 6);
    const xs = points.map((point) => point.x);
    expect(toPixels(STANDING.feet.x)).toBeGreaterThan(Math.min(...xs));
    expect(toPixels(STANDING.feet.x)).toBeLessThan(Math.max(...xs));
  });
});

describe('the stick man walking', () => {
  it('always has a foot on the floor and never one under it', () => {
    for (const walkCycle of CYCLE_SAMPLES) {
      const feetY = skeletonOf({ ...WALKING, walkCycle }).legs.map((leg) => leg[2]!.y);
      expect(Math.max(...feetY)).toBeCloseTo(WALKING.feet.y, 6);
    }
  });

  it('moves every limb through the cycle and comes back to where it started', () => {
    expect(stickManStrokes({ ...WALKING, walkCycle: 1 })).toEqual(stickManStrokes({ ...WALKING, walkCycle: 0 }));
    const start = skeletonOf({ ...WALKING, walkCycle: 0 });
    const quarter = skeletonOf({ ...WALKING, walkCycle: 0.25 });
    for (const limb of [0, 1]) {
      expect(quarter.legs[limb]![2]!.x).not.toBeCloseTo(start.legs[limb]![2]!.x, 2);
      expect(quarter.arms[limb]![2]!.x).not.toBeCloseTo(start.arms[limb]![2]!.x, 2);
    }
  });

  it('takes the second step as the mirror of the first: the legs swap', () => {
    const first = skeletonOf({ ...WALKING, walkCycle: 0.1 });
    const second = skeletonOf({ ...WALKING, walkCycle: 0.6 });
    expect(second.legs[0]).toEqual(first.legs[1]);
    expect(second.legs[1]![2]!.x).toBeCloseTo(first.legs[0]![2]!.x, 6);
  });

  it('swings each arm with the opposite leg', () => {
    const { legs, arms, hip, neck } = skeletonOf({ ...WALKING, walkCycle: 0 });
    const legIsForward = legs[0]![2]!.x > hip.x;
    const armIsForward = arms[0]![2]!.x > neck.x;
    expect(legIsForward).toBe(true);
    expect(armIsForward).toBe(false);
    expect(arms[1]![2]!.x).toBeGreaterThan(neck.x);
  });

  it('keeps his planted foot where it is on the floor while he moves a cycle length per cycle', () => {
    const plantedAt = (walkCycle: number): number => skeletonOf({ ...WALKING, feet: { x: walkCycle * walkCycleLength(), y: 0 }, walkCycle }).legs[0]![2]!.x;
    const touchdown = plantedAt(0);
    for (let walkCycle = 0; walkCycle < 0.5; walkCycle += 0.02) expect(Math.abs(plantedAt(walkCycle) - touchdown)).toBeLessThan(0.02);
  });

  it('bends the knee of the leg that swings forward, so that foot clears the floor', () => {
    const { legs } = skeletonOf({ ...WALKING, walkCycle: 0.75 });
    expect(legs[0]![2]!.y).toBeLessThan(WALKING.feet.y - 0.05);
  });

  it('faces left as the mirror of facing right', () => {
    for (const walkCycle of CYCLE_SAMPLES) {
      const right = stickManStrokes({ ...WALKING, walkCycle, facing: 1 }).flatMap((stroke) => stroke.points);
      const left = stickManStrokes({ ...WALKING, walkCycle, facing: -1 }).flatMap((stroke) => stroke.points);
      const mirror = toPixels(WALKING.feet.x);
      // The head is a circle drawn the same way round whichever way he faces, so compare what it covers.
      expect(Math.min(...left.map((point) => point.x))).toBeCloseTo(2 * mirror - Math.max(...right.map((point) => point.x)), 6);
      expect(Math.max(...left.map((point) => point.x))).toBeCloseTo(2 * mirror - Math.min(...right.map((point) => point.x)), 6);
      expect(left.map((point) => point.y)).toEqual(right.map((point) => point.y));
    }
  });
});

// ---- Helpers ----

const STANDING: StickManPose = { feet: { x: 3, y: 0.5 }, facing: 1, action: 'standing', walkCycle: 0 };
const WALKING: StickManPose = { feet: { x: 3, y: 0.5 }, facing: 1, action: 'walking', walkCycle: 0 };
const CYCLE_SAMPLES = Array.from({ length: 40 }, (_, sample) => sample / 40);
