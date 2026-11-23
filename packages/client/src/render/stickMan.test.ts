import { createSim, levels, STICK_MAN_HEIGHT, STICK_MAN_WIDTH, stickManOf, type Command, type FloorSegment } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { distanceBetweenLines } from './geometry';
import { __testing__, keptOffTheFloor, poseOf, posesEasedOverTime, stickManStrokes, walkCycleLength, type StickManPose } from './stickMan';
import { toPixels } from './units';

const { skeletonOf, BODY, EASING, OFF_THE_LINE } = __testing__;

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
    poseFor(ON_THE_FLOOR, FRAME, NO_FLOOR);
    const first = poseFor(GOING_UP, FRAME, NO_FLOOR);
    expect(first.feet).toEqual(GOING_UP.feet);
    expect(first.inTheAir).toBeGreaterThan(0);
    expect(first.inTheAir).toBeLessThan(0.2);
    let pose = first;
    for (let frame = 0; frame < framesIn(EASING.intoTheAir); frame += 1) {
      const next = poseFor(GOING_UP, FRAME, NO_FLOOR);
      expect(next.inTheAir).toBeGreaterThanOrEqual(pose.inTheAir);
      pose = next;
    }
    expect(pose.inTheAir).toBe(1);
  });

  it('takes the landing with a knee bend that eases out, while his limbs come back from the jump', () => {
    const poseFor = posesEasedOverTime();
    poseFor(ON_THE_FLOOR, FRAME, NO_FLOOR);
    for (let frame = 0; frame < 30; frame += 1) poseFor(COMING_DOWN, FRAME, NO_FLOOR);
    const touchdown = poseFor(ON_THE_FLOOR, FRAME, NO_FLOOR);
    expect(touchdown.landing).toBe(1);
    expect(touchdown.inTheAir).toBeGreaterThan(0.8);
    const soonAfter = poseFor(ON_THE_FLOOR, FRAME, NO_FLOOR);
    expect(soonAfter.landing).toBeLessThan(1);
    expect(soonAfter.inTheAir).toBeLessThan(touchdown.inTheAir);
    let pose = soonAfter;
    for (let frame = 0; frame < framesIn(EASING.landing); frame += 1) pose = poseFor(ON_THE_FLOOR, FRAME, NO_FLOOR);
    expect(pose).toEqual(poseOf(ON_THE_FLOOR));
  });

  it('does not bend his knees when he was not coming down: a level that starts again just shows him standing', () => {
    const poseFor = posesEasedOverTime();
    poseFor(ON_THE_FLOOR, FRAME, NO_FLOOR);
    poseFor({ ...COMING_DOWN, feet: { x: -1, y: 6 } }, FRAME, NO_FLOOR);
    expect(poseFor(ON_THE_FLOOR, FRAME, NO_FLOOR)).toEqual(poseOf(ON_THE_FLOOR));
  });
});

describe('the stick man in a long fall', () => {
  it('throws his arms up and out once he falls faster than a jump lands, and not before', () => {
    const handsAboveShoulders = (verticalSpeed: number): number => {
      const { arms } = skeletonOf(poseOf({ ...FALLING, verticalSpeed }));
      return Math.min(...arms.map((arm) => arm[0]!.y - arm[2]!.y));
    };
    expect(poseOf({ ...FALLING, verticalSpeed: BODY.speedOfALongFall.from }).longFall).toBe(0);
    expect(handsAboveShoulders(BODY.speedOfALongFall.from)).toBeLessThan(0);
    expect(poseOf({ ...FALLING, verticalSpeed: BODY.speedOfALongFall.to + 5 }).longFall).toBe(1);
    expect(handsAboveShoulders(BODY.speedOfALongFall.to)).toBeGreaterThan(0.1);
    const { arms, neck } = skeletonOf(poseOf({ ...FALLING, verticalSpeed: BODY.speedOfALongFall.to }));
    expect(arms[0]![2]!.x).toBeLessThan(neck.x - 0.3);
    expect(arms[1]![2]!.x).toBeGreaterThan(neck.x + 0.3);
  });

  it('is not what he does on the floor, however the sim has his speed', () => {
    expect(poseOf({ ...ON_THE_FLOOR, verticalSpeed: 20 }).longFall).toBe(0);
  });
});

describe('the stick man falling sideways', () => {
  it('tips the way he drifts, more the faster he drifts against how fast he falls, and stays upright dropping straight', () => {
    const tiltAt = (horizontalSpeed: number, verticalSpeed: number): number => poseOf({ ...FALLING, horizontalSpeed, verticalSpeed }).tilt;
    expect(tiltAt(0, 4)).toBe(0);
    expect(tiltAt(2, 4)).toBeGreaterThan(0);
    expect(tiltAt(-2, 4)).toBeCloseTo(-tiltAt(2, 4), 9);
    expect(tiltAt(2, 4)).toBeGreaterThan(tiltAt(1, 4));
    expect(tiltAt(2, 4)).toBeGreaterThan(tiltAt(2, 8));
    expect(tiltAt(2, 4)).toBeLessThanOrEqual(BODY.fallTilt);
  });

  it('is upright on the floor, however fast he goes sideways', () => {
    expect(poseOf({ ...ON_THE_FLOOR, action: 'walking', horizontalSpeed: 2 }).tilt).toBe(0);
  });

  it('is not tipped by a jump, forward or back, on the way up or on the way down', () => {
    for (const horizontalSpeed of [2, -2]) {
      expect(poseOf({ ...GOING_UP, horizontalSpeed }).tilt).toBe(0);
      expect(poseOf({ ...COMING_DOWN, horizontalSpeed }).tilt).toBe(0);
      expect(stickManStrokes(poseOf({ ...COMING_DOWN, horizontalSpeed, facing: 1 }))).toEqual(stickManStrokes(poseOf({ ...COMING_DOWN, horizontalSpeed: 0, facing: 1 })));
    }
  });

  it('has only begun to tip when the fall has only begun', () => {
    expect(poseOf({ ...FALLING, horizontalSpeed: 2, verticalSpeed: 0.2 }).tilt).toBeLessThan(poseOf({ ...FALLING, horizontalSpeed: 2, verticalSpeed: 2 }).tilt / 3);
  });

  it('puts his head ahead of his hips and his feet behind them, with his lower foot still where the sim says', () => {
    for (const facing of [1, -1] as const) {
      const upright = skeletonOf({ ...JUMPING, rise: -1, facing });
      const tipped = skeletonOf({ ...JUMPING, rise: -1, facing, tilt: 0.3 });
      expect(tipped.head.x - tipped.hip.x).toBeGreaterThan(upright.head.x - upright.hip.x + 0.1);
      for (const leg of [0, 1]) expect(tipped.legs[leg]![2]!.x).toBeLessThan(upright.legs[leg]![2]!.x);
      expect(Math.max(...tipped.legs.map((leg) => leg[2]!.y))).toBeCloseTo(JUMPING.feet.y, 6);
    }
  });

  it('tips over a few frames, and comes back upright over a few once he has landed', () => {
    const poseFor = posesEasedOverTime();
    const falling = { ...FALLING, horizontalSpeed: 2, verticalSpeed: 3 };
    poseFor(falling, FRAME, NO_FLOOR);
    const first = poseFor(falling, FRAME, NO_FLOOR).tilt;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(poseOf(falling).tilt);
    for (let frame = 0; frame < 30; frame += 1) poseFor(falling, FRAME, NO_FLOOR);
    expect(poseFor(falling, FRAME, NO_FLOOR).tilt).toBeCloseTo(poseOf(falling).tilt, 9);
    expect(poseFor({ ...ON_THE_FLOOR, feet: falling.feet }, FRAME, NO_FLOOR).tilt).toBeGreaterThan(0);
    for (let frame = 0; frame < 30; frame += 1) poseFor({ ...ON_THE_FLOOR, feet: falling.feet }, FRAME, NO_FLOOR);
    expect(poseFor({ ...ON_THE_FLOOR, feet: falling.feet }, FRAME, NO_FLOOR).tilt).toBe(0);
  });
});

describe('the stick man dropping past the end of a floor line', () => {
  it('is left as he is when nothing of him is near a line', () => {
    const pose = { ...DROPPING, feet: { x: LINE_END + 2, y: 0.5 } };
    expect(keptOffTheFloor(pose, FLOOR)).toEqual(pose);
  });

  it('never has an arm, his body or his head across the line, all the way down beside it', () => {
    for (const facing of [1, -1] as const) {
      for (const feet of DROP_BESIDE_THE_END) {
        const skeleton = skeletonOf(keptOffTheFloor({ ...DROPPING, facing, feet }, FLOOR));
        for (const arm of skeleton.arms) {
          expect(distanceBetweenLines([arm[0]!, arm[1]!], LINE), `arm at feet y ${feet.y}`).toBeGreaterThan(0);
          expect(distanceBetweenLines([arm[1]!, arm[2]!], LINE), `forearm at feet y ${feet.y}`).toBeGreaterThan(0);
        }
        expect(distanceBetweenLines([skeleton.neck, skeleton.hip], LINE)).toBeGreaterThan(0);
        expect(distanceBetweenLines([skeleton.head, skeleton.head], LINE)).toBeGreaterThan(BODY.headRadius);
      }
    }
  });

  it('holds the arm that would cross on the line: lifted no more than it takes, so the arm rests on it', () => {
    const lifts = DROP_BESIDE_THE_END.map((feet) => keptOffTheFloor({ ...DROPPING, feet }, FLOOR));
    const held = lifts.filter((pose) => pose.armsLifted[BACK_ARM] > 0);
    expect(held.length).toBeGreaterThan(3);
    for (const pose of held) {
      const [shoulder, elbow, hand] = skeletonOf(pose).arms[BACK_ARM]!;
      const fromTheLine = Math.min(distanceBetweenLines([shoulder!, elbow!], LINE), distanceBetweenLines([elbow!, hand!], LINE));
      expect(fromTheLine).toBeLessThan(OFF_THE_LINE + 0.03);
    }
  });

  it('pushes the held arm further up as he drops, then lets it go once his shoulder is under the line', () => {
    const lifts = DROP_BESIDE_THE_END.map((feet) => keptOffTheFloor({ ...DROPPING, feet }, FLOOR).armsLifted[BACK_ARM]);
    const firstHeld = lifts.findIndex((lift) => lift > 0);
    const lastHeld = lifts.length - 1 - [...lifts].reverse().findIndex((lift) => lift > 0);
    expect(firstHeld).toBeGreaterThan(0);
    for (let drop = firstHeld + 1; drop <= lastHeld; drop += 1) expect(lifts[drop]).toBeGreaterThanOrEqual(lifts[drop - 1]!);
    expect(lifts[lastHeld]).toBeGreaterThan(lifts[firstHeld]! + 0.3);
    expect(lifts.slice(lastHeld + 1).length).toBeGreaterThan(0);
    const shoulderWhenLetGo = skeletonOf({ ...DROPPING, feet: DROP_BESIDE_THE_END[lastHeld + 1]! }).arms[BACK_ARM]![0]!;
    // By then his arm reaches round the end of the line and under it.
    expect(shoulderWhenLetGo.y).toBeGreaterThan(LINE[0].y - BODY.upperArm);
  });

  it('leaves the arm on the other side of him where it was', () => {
    for (const feet of DROP_BESIDE_THE_END) expect(keptOffTheFloor({ ...DROPPING, feet }, FLOOR).armsLifted[1 - BACK_ARM]).toBe(0);
  });

  it('tips him less, or not at all, when tipping would put his head across a line', () => {
    const towardsTheLine = { ...DROPPING, feet: { x: BESIDE_THE_END, y: 1.5 }, tilt: -0.5 };
    const kept = keptOffTheFloor(towardsTheLine, FLOOR);
    expect(kept.tilt).toBeGreaterThan(towardsTheLine.tilt);
    expect(kept.tilt).toBeLessThanOrEqual(0);
    const awayFromTheLine = { ...towardsTheLine, tilt: 0.5 };
    expect(keptOffTheFloor(awayFromTheLine, FLOOR).tilt).toBe(0.5);
  });

  it('fits inside the width the sim keeps clear of a line: his head, with the room a pencil line takes', () => {
    expect(BODY.headRadius + OFF_THE_LINE).toBeLessThan(STICK_MAN_WIDTH / 2);
  });

  it('has nothing but his feet across a line in any fall the sim gives him, on every level, at one frame a tick and at one every three', () => {
    for (const level of levels) {
      for (const ticksPerFrame of [1, 3]) {
        for (const keys of WAYS_TO_FALL) {
          const sim = createSim({ level: level.id });
          const poseFor = posesEasedOverTime();
          for (let tick = 0; tick < 420 && sim.level === level.id; tick += 1) {
            sim.step(keys(tick));
            if (tick % ticksPerFrame !== 0) continue;
            const stickMan = stickManOf(sim);
            const { head, neck, hip, arms } = skeletonOf(poseFor(stickMan, ticksPerFrame * FRAME, level.floor));
            if (stickMan.action !== 'jumping') continue;
            const where = `level ${level.id}, tick ${tick}, feet (${stickMan.feet.x.toFixed(3)}, ${stickMan.feet.y.toFixed(3)})`;
            for (const { from, to } of level.floor) {
              for (const arm of arms) {
                expect(distanceBetweenLines([arm[0]!, arm[1]!], [from, to]), `upper arm, ${where}`).toBeGreaterThan(0);
                expect(distanceBetweenLines([arm[1]!, arm[2]!], [from, to]), `forearm, ${where}`).toBeGreaterThan(0);
              }
              expect(distanceBetweenLines([neck, hip], [from, to]), `body, ${where}`).toBeGreaterThan(0);
              expect(distanceBetweenLines([head, head], [from, to]), `head, ${where}`).toBeGreaterThan(BODY.headRadius);
            }
          }
        }
      }
    }
  });

  it('lets the arm come down over a few frames once the line lets go, never across the line on the way', () => {
    const poseFor = posesEasedOverTime();
    const shown = DROP_BESIDE_THE_END.map((feet) => poseFor({ ...FALLING, feet }, FRAME, FLOOR));
    const lifts = shown.map((pose) => pose.armsLifted[BACK_ARM]);
    expect(Math.max(...lifts)).toBeGreaterThan(0.3);
    expect(lifts[lifts.length - 1]).toBe(0);
    for (let frame = 1; frame < lifts.length; frame += 1) expect(lifts[frame - 1]! - lifts[frame]!).toBeLessThanOrEqual(FRAME * EASING.armComesDownPerSecond + 1e-9);
    for (const pose of shown) {
      const [shoulder, elbow, hand] = skeletonOf(pose).arms[BACK_ARM]!;
      expect(distanceBetweenLines([shoulder!, elbow!], LINE)).toBeGreaterThan(0);
      expect(distanceBetweenLines([elbow!, hand!], LINE)).toBeGreaterThan(0);
    }
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

const STANDING: StickManPose = { feet: { x: 3, y: 0.5 }, facing: 1, action: 'standing', walkCycle: 0, rise: 0, longFall: 0, striding: false, inTheAir: 0, landing: 0, tilt: 0, armsLifted: [0, 0] };
const WALKING: StickManPose = { feet: { x: 3, y: 0.5 }, facing: 1, action: 'walking', walkCycle: 0, rise: 0, longFall: 0, striding: true, inTheAir: 0, landing: 0, tilt: 0, armsLifted: [0, 0] };
const JUMPING: StickManPose = { feet: { x: 3, y: 0.2 }, facing: 1, action: 'jumping', walkCycle: 0, rise: 1, longFall: 0, striding: false, inTheAir: 1, landing: 0, tilt: 0, armsLifted: [0, 0] };
const view = { feet: { x: 3, y: 0.5 }, facing: -1, action: 'walking', distanceWalked: 0, verticalSpeed: 0, horizontalSpeed: 0, fallingOffAnEdge: false, walkDirectionAsked: -1 } as const;
const ON_THE_FLOOR = { feet: { x: 3, y: 0 }, facing: 1, action: 'standing', distanceWalked: 0, verticalSpeed: 0, horizontalSpeed: 0, fallingOffAnEdge: false, walkDirectionAsked: 0 } as const;
const GOING_UP = { ...ON_THE_FLOOR, feet: { x: 3, y: -0.2 }, action: 'jumping', verticalSpeed: -5 } as const;
const COMING_DOWN = { ...ON_THE_FLOOR, feet: { x: 3, y: -0.2 }, action: 'jumping', verticalSpeed: 4 } as const;
/** In the air because he walked off an edge. */
const FALLING = { ...COMING_DOWN, horizontalSpeed: 0, fallingOffAnEdge: true } as const;
/** A floor line that ends at `LINE_END`, with him dropping on the open side of it, as close as the sim lets him: half his width away. */
const LINE_END = 6;
const FLOOR = [{ from: { x: 0, y: 0 }, to: { x: LINE_END, y: 0 } }];
const LINE = [FLOOR[0]!.from, FLOOR[0]!.to] as const;
/** Coming down facing away from the line, so his back arm is the one over it. */
const BESIDE_THE_END = LINE_END + STICK_MAN_WIDTH / 2;
const DROPPING: StickManPose = { feet: { x: BESIDE_THE_END, y: 0 }, facing: 1, action: 'jumping', walkCycle: 0, rise: -1, longFall: 0, striding: false, inTheAir: 1, landing: 0, tilt: 0, armsLifted: [0, 0] };
const BACK_ARM = 0;
/** His feet from the line's height to well below it, in small steps: slower than he ever falls, so every moment of the hold is looked at. */
const DROP_BESIDE_THE_END = Array.from({ length: 80 }, (_, step) => ({ x: BESIDE_THE_END, y: step * 0.03 }));
const WALK = (direction: -1 | 0 | 1): Command => ({ type: 'player/walk', direction });
const JUMP: Command = { type: 'player/jump' };
/** The keys, tick by tick, of the falls a player gets into: off either way, letting go, steering back, hopping at an edge, jumping short. */
const WAYS_TO_FALL: readonly ((tick: number) => Command[])[] = [
  (tick) => (tick === 0 ? [WALK(1)] : []),
  (tick) => (tick === 0 ? [WALK(-1)] : []),
  (tick) => (tick === 0 ? [WALK(1)] : tick === 112 ? [WALK(0)] : []),
  (tick) => (tick === 0 ? [WALK(1)] : tick === 112 ? [WALK(-1)] : []),
  (tick) => (tick === 0 ? [WALK(-1)] : tick === 57 ? [WALK(1)] : []),
  (tick) => (tick === 0 ? [WALK(1)] : tick === 106 ? [WALK(0)] : tick === 120 ? [JUMP, WALK(1)] : tick === 123 ? [WALK(0)] : []),
  (tick) => (tick === 0 ? [WALK(1)] : tick === 80 ? [JUMP] : []),
  (tick) => (tick === 0 ? [WALK(1)] : tick === 100 ? [JUMP] : tick === 110 ? [WALK(0)] : []),
  (tick) => (tick === 0 ? [WALK(-1)] : tick === 50 ? [WALK(0)] : tick === 60 ? [JUMP, WALK(-1)] : tick === 64 ? [WALK(0)] : []),
];
const FRAME = 1 / 60;
const NO_FLOOR: readonly FloorSegment[] = [];
const framesIn = (seconds: number): number => Math.ceil(seconds / FRAME) + 1;
const CYCLE_SAMPLES = Array.from({ length: 40 }, (_, sample) => sample / 40);
