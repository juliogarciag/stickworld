import { STICK_MAN_HEIGHT } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, poseOf, posesEasedOverTime, stickManStrokes, walkCycleLength, type StickManPose } from './stickMan';
import { toPixels } from './units';

const { skeletonOf, BODY, EASING } = __testing__;

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

  it('tucks his legs most at the top, and reaches for the floor with them on the way down', () => {
    const hipAbove = (rise: number): number => JUMPING.feet.y - skeletonOf({ ...JUMPING, rise }).hip.y;
    expect(hipAbove(0)).toBeLessThan(hipAbove(1));
    expect(hipAbove(1)).toBeLessThan(hipAbove(-1));
  });

  it('has his hands highest at the top, and lower again before he lands', () => {
    const handsAbove = (rise: number): number => {
      const { arms, neck } = skeletonOf({ ...JUMPING, rise });
      return neck.y - Math.min(...arms.map((arm) => arm[2]!.y));
    };
    expect(handsAbove(0)).toBeGreaterThan(handsAbove(1));
    expect(handsAbove(0)).toBeGreaterThan(handsAbove(-1));
  });

  it('is standing when he is not in the air at all, and something in between on the way there', () => {
    const jointsAt = (inTheAir: number): number[] => stickManStrokes({ ...JUMPING, feet: STANDING.feet, inTheAir }).flatMap((stroke) => stroke.points.map((point) => point.y));
    expect(jointsAt(0)).toEqual(stickManStrokes({ ...STANDING, action: 'jumping' }).flatMap((stroke) => stroke.points.map((point) => point.y)));
    expect(jointsAt(0.5)).not.toEqual(jointsAt(0));
    expect(jointsAt(0.5)).not.toEqual(jointsAt(1));
  });

  it('does not look like standing or walking', () => {
    expect(stickManStrokes(JUMPING)).not.toEqual(stickManStrokes({ ...STANDING, feet: JUMPING.feet }));
    expect(stickManStrokes(JUMPING)).not.toEqual(stickManStrokes({ ...WALKING, feet: JUMPING.feet }));
  });

  it('comes from his walk when he jumps while walking', () => {
    const midStride = { ...JUMPING, striding: true, walkCycle: 0.3, inTheAir: 0 };
    expect(skeletonOf(midStride).legs).toEqual(skeletonOf({ ...WALKING, feet: JUMPING.feet, walkCycle: 0.3 }).legs);
  });
});

describe('the stick man landing', () => {
  it('bends his knees with his feet still on the floor, deeper the harder into the landing he is', () => {
    const hipAbove = (landing: number): number => STANDING.feet.y - skeletonOf({ ...STANDING, landing }).hip.y;
    expect(hipAbove(1)).toBeLessThan(hipAbove(0.5));
    expect(hipAbove(0.5)).toBeLessThan(hipAbove(0));
    for (const leg of skeletonOf({ ...STANDING, landing: 1 }).legs) expect(leg[2]!.y).toBeCloseTo(STANDING.feet.y, 6);
  });
});

describe('poses eased over time', () => {
  it('gets into the jump over a few frames instead of at once, and never moves where he is', () => {
    const poseFor = posesEasedOverTime();
    poseFor(ON_THE_FLOOR, FRAME);
    const first = poseFor(GOING_UP, FRAME);
    expect(first.feet).toEqual(GOING_UP.feet);
    expect(first.inTheAir).toBeGreaterThan(0);
    expect(first.inTheAir).toBeLessThan(0.2);
    let pose = first;
    for (let frame = 0; frame < framesIn(EASING.intoTheAir); frame += 1) {
      const next = poseFor(GOING_UP, FRAME);
      expect(next.inTheAir).toBeGreaterThanOrEqual(pose.inTheAir);
      pose = next;
    }
    expect(pose.inTheAir).toBe(1);
  });

  it('takes the landing with a knee bend that eases out, while his limbs come back from the jump', () => {
    const poseFor = posesEasedOverTime();
    poseFor(ON_THE_FLOOR, FRAME);
    for (let frame = 0; frame < 30; frame += 1) poseFor(COMING_DOWN, FRAME);
    const touchdown = poseFor(ON_THE_FLOOR, FRAME);
    expect(touchdown.landing).toBe(1);
    expect(touchdown.inTheAir).toBeGreaterThan(0.8);
    const soonAfter = poseFor(ON_THE_FLOOR, FRAME);
    expect(soonAfter.landing).toBeLessThan(1);
    expect(soonAfter.inTheAir).toBeLessThan(touchdown.inTheAir);
    let pose = soonAfter;
    for (let frame = 0; frame < framesIn(EASING.landing); frame += 1) pose = poseFor(ON_THE_FLOOR, FRAME);
    expect(pose).toEqual(poseOf(ON_THE_FLOOR));
  });

  it('does not bend his knees when he was not coming down: a level that starts again just shows him standing', () => {
    const poseFor = posesEasedOverTime();
    poseFor(ON_THE_FLOOR, FRAME);
    poseFor({ ...COMING_DOWN, feet: { x: -1, y: 6 } }, FRAME);
    expect(poseFor(ON_THE_FLOOR, FRAME)).toEqual(poseOf(ON_THE_FLOOR));
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

const STANDING: StickManPose = { feet: { x: 3, y: 0.5 }, facing: 1, action: 'standing', walkCycle: 0, rise: 0, striding: false, inTheAir: 0, landing: 0 };
const WALKING: StickManPose = { feet: { x: 3, y: 0.5 }, facing: 1, action: 'walking', walkCycle: 0, rise: 0, striding: true, inTheAir: 0, landing: 0 };
const JUMPING: StickManPose = { feet: { x: 3, y: 0.2 }, facing: 1, action: 'jumping', walkCycle: 0, rise: 1, striding: false, inTheAir: 1, landing: 0 };
const view = { feet: { x: 3, y: 0.5 }, facing: -1, action: 'walking', distanceWalked: 0, verticalSpeed: 0, walkDirectionAsked: -1 } as const;
const ON_THE_FLOOR = { feet: { x: 3, y: 0 }, facing: 1, action: 'standing', distanceWalked: 0, verticalSpeed: 0, walkDirectionAsked: 0 } as const;
const GOING_UP = { ...ON_THE_FLOOR, feet: { x: 3, y: -0.2 }, action: 'jumping', verticalSpeed: -5 } as const;
const COMING_DOWN = { ...ON_THE_FLOOR, feet: { x: 3, y: -0.2 }, action: 'jumping', verticalSpeed: 4 } as const;
const FRAME = 1 / 60;
const framesIn = (seconds: number): number => Math.ceil(seconds / FRAME) + 1;
const CYCLE_SAMPLES = Array.from({ length: 40 }, (_, sample) => sample / 40);
