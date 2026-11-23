import { STICK_MAN_HEIGHT } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, poseOf, stickManStrokes, walkCycleLength, type StickManPose } from './stickMan';
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

  it('stands the same wherever his last walk cycle stopped', () => {
    expect(stickManStrokes({ ...STANDING, walkCycle: 0.7 })).toEqual(stickManStrokes(STANDING));
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
  it('always has a foot on the floor, and no knee or hip ever at or under it', () => {
    for (const walkCycle of CYCLE_SAMPLES) {
      const { legs, hip } = skeletonOf({ ...WALKING, walkCycle });
      expect(Math.max(...legs.map((leg) => leg[2]!.y))).toBeCloseTo(WALKING.feet.y, 6);
      for (const leg of legs) expect(leg[1]!.y).toBeLessThan(WALKING.feet.y - BODY.shin / 2);
      expect(hip.y).toBeLessThan(WALKING.feet.y - BODY.thigh);
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

describe('the stick man jumping', () => {
  it('has his lower foot exactly where the sim says his feet are, all the way up and down', () => {
    for (const rise of [1, 0.5, 0, -0.5, -1]) {
      const { legs } = skeletonOf({ ...JUMPING, rise });
      expect(Math.max(...legs.map((leg) => leg[2]!.y))).toBeCloseTo(JUMPING.feet.y, 6);
    }
  });

  it('tucks his legs more on the way up than on the way down', () => {
    const hipAbove = (rise: number): number => JUMPING.feet.y - skeletonOf({ ...JUMPING, rise }).hip.y;
    expect(hipAbove(1)).toBeLessThan(hipAbove(-1));
  });

  it('does not look like standing or walking', () => {
    expect(stickManStrokes(JUMPING)).not.toEqual(stickManStrokes({ ...JUMPING, action: 'standing' }));
    expect(stickManStrokes(JUMPING)).not.toEqual(stickManStrokes({ ...JUMPING, action: 'walking' }));
  });
});

describe('the stick man cheering', () => {
  it('stands with both hands up beside his head, higher than his neck', () => {
    const { arms, legs, head } = skeletonOf({ ...STANDING, action: 'cheering' });
    for (const arm of arms) expect(arm[2]!.y).toBeLessThan(head.y);
    expect(arms[0]![2]!.x).toBeLessThan(head.x - BODY.headRadius);
    expect(arms[1]![2]!.x).toBeGreaterThan(head.x + BODY.headRadius);
    expect(legs).toEqual(skeletonOf(STANDING).legs);
  });
});

describe('the pose for what the sim says', () => {
  it('keeps where he is, which way he faces and what he is doing', () => {
    expect(poseOf(view)).toMatchObject({ feet: view.feet, facing: -1, action: 'walking' });
  });

  it('goes through one walk cycle per cycle length walked', () => {
    expect(poseOf({ ...view, distanceWalked: walkCycleLength() * 0.25 }).walkCycle).toBeCloseTo(0.25, 6);
    expect(poseOf({ ...view, distanceWalked: walkCycleLength() * 3.5 }).walkCycle).toBeCloseTo(0.5, 6);
  });

  it('rises while he moves up and falls while he moves down, never past 1', () => {
    expect(poseOf({ ...view, verticalSpeed: -100 }).rise).toBe(1);
    expect(poseOf({ ...view, verticalSpeed: 100 }).rise).toBe(-1);
    expect(poseOf({ ...view, verticalSpeed: 0 }).rise).toBeCloseTo(0, 6);
    expect(poseOf({ ...view, verticalSpeed: -1 }).rise).toBeGreaterThan(0);
  });
});

// ---- Helpers ----

const STANDING: StickManPose = { feet: { x: 3, y: 0.5 }, facing: 1, action: 'standing', walkCycle: 0, rise: 0 };
const WALKING: StickManPose = { feet: { x: 3, y: 0.5 }, facing: 1, action: 'walking', walkCycle: 0, rise: 0 };
const JUMPING: StickManPose = { feet: { x: 3, y: 0.2 }, facing: 1, action: 'jumping', walkCycle: 0, rise: 1 };
const view = { feet: { x: 3, y: 0.5 }, facing: -1, action: 'walking', distanceWalked: 0, verticalSpeed: 0, walkDirectionAsked: -1 } as const;
const CYCLE_SAMPLES = Array.from({ length: 40 }, (_, sample) => sample / 40);
