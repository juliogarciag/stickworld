import {
  createSim,
  levels,
  MOVEMENT_PRESETS,
  STICK_MAN_HEIGHT,
  STICK_MAN_WIDTH,
  getStickMan,
  type Command,
  type FloorSegment,
} from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { measureDistanceBetweenLines } from './geometry';
import {
  __testing__,
  keepOffFloor,
  getPose,
  easePosesOverTime,
  seatIn,
  buildStickManStrokes,
  getWalkCycleLength,
  type StickManPose,
} from './stickMan';
import { convertToPixels } from './units';

const { getSkeleton, BODY, EASING, LINE_CLEARANCE } = __testing__;

describe('the stick man standing', () => {
  it('is a head, a body, two arms and two legs', () => {
    const strokes = buildStickManStrokes(STANDING);
    expect(strokes).toHaveLength(6);
    expect(strokes.filter((stroke) => stroke.isClosed)).toHaveLength(1);
    expect(
      strokes.filter((stroke) => !stroke.isClosed).map((stroke) => stroke.points.length),
    ).toEqual([2, 3, 3, 3, 3]);
  });

  it("has the stick man's feet on the floor and is as tall as the sim says the stick man is", () => {
    const skeleton = getSkeleton(STANDING);
    for (const leg of skeleton.legs) {
      expect(leg[2]!.y).toBeCloseTo(STANDING.feet.y, 6);
    }
    const height = STANDING.feet.y - (skeleton.head.y - BODY.headRadius);
    expect(height).toBeGreaterThan(STICK_MAN_HEIGHT * 0.95);
    expect(height).toBeLessThanOrEqual(STICK_MAN_HEIGHT);
  });

  it("stands the same wherever the stick man's last walk cycle stopped", () => {
    expect(buildStickManStrokes({ ...STANDING, walkCycle: 0.7 })).toEqual(
      buildStickManStrokes(STANDING),
    );
  });

  it("is drawn in world pixels, where the stick man's feet are", () => {
    const points = buildStickManStrokes(STANDING).flatMap((stroke) => stroke.points);
    expect(Math.max(...points.map((point) => point.y))).toBeCloseTo(
      convertToPixels(STANDING.feet.y),
      6,
    );
    const xs = points.map((point) => point.x);
    expect(convertToPixels(STANDING.feet.x)).toBeGreaterThan(Math.min(...xs));
    expect(convertToPixels(STANDING.feet.x)).toBeLessThan(Math.max(...xs));
  });
});

describe('the stick man walking', () => {
  it('always has a foot on the floor, and no knee or hip ever at or under it', () => {
    for (const walkCycle of CYCLE_SAMPLES) {
      const { legs, hip } = getSkeleton({ ...WALKING, walkCycle });
      expect(Math.max(...legs.map((leg) => leg[2]!.y))).toBeCloseTo(WALKING.feet.y, 6);
      for (const leg of legs) {
        expect(leg[1]!.y).toBeLessThan(WALKING.feet.y - BODY.shin / 2);
      }
      expect(hip.y).toBeLessThan(WALKING.feet.y - BODY.thigh);
    }
  });

  it('moves every limb through the cycle and comes back to where it started', () => {
    expect(buildStickManStrokes({ ...WALKING, walkCycle: 1 })).toEqual(
      buildStickManStrokes({ ...WALKING, walkCycle: 0 }),
    );
    const start = getSkeleton({ ...WALKING, walkCycle: 0 });
    const quarter = getSkeleton({ ...WALKING, walkCycle: 0.25 });
    for (const limb of [0, 1]) {
      expect(quarter.legs[limb]![2]!.x).not.toBeCloseTo(start.legs[limb]![2]!.x, 2);
      expect(quarter.arms[limb]![2]!.x).not.toBeCloseTo(start.arms[limb]![2]!.x, 2);
    }
  });

  it('takes the second step as the mirror of the first: the legs swap', () => {
    const first = getSkeleton({ ...WALKING, walkCycle: 0.1 });
    const second = getSkeleton({ ...WALKING, walkCycle: 0.6 });
    expect(second.legs[0]).toEqual(first.legs[1]);
    expect(second.legs[1]![2]!.x).toBeCloseTo(first.legs[0]![2]!.x, 6);
  });

  it('swings each arm with the opposite leg', () => {
    const { legs, arms, hip, neck } = getSkeleton({ ...WALKING, walkCycle: 0 });
    const isLegForward = legs[0]![2]!.x > hip.x;
    const isArmForward = arms[0]![2]!.x > neck.x;
    expect(isLegForward).toBe(true);
    expect(isArmForward).toBe(false);
    expect(arms[1]![2]!.x).toBeGreaterThan(neck.x);
  });

  it("keeps the stick man's planted foot where it is on the floor while the stick man moves a cycle length per cycle", () => {
    const getPlantedAt = (walkCycle: number): number =>
      getSkeleton({ ...WALKING, feet: { x: walkCycle * getWalkCycleLength(), y: 0 }, walkCycle })
        .legs[0]![2]!.x;
    const touchdown = getPlantedAt(0);
    for (let walkCycle = 0; walkCycle < 0.5; walkCycle += 0.02) {
      expect(Math.abs(getPlantedAt(walkCycle) - touchdown)).toBeLessThan(0.02);
    }
  });

  it('bends the knee of the leg that swings forward, so that foot clears the floor', () => {
    const { legs } = getSkeleton({ ...WALKING, walkCycle: 0.75 });
    expect(legs[0]![2]!.y).toBeLessThan(WALKING.feet.y - 0.05);
  });

  it('faces left as the mirror of facing right', () => {
    for (const walkCycle of CYCLE_SAMPLES) {
      const right = buildStickManStrokes({ ...WALKING, walkCycle, facing: 1 }).flatMap(
        (stroke) => stroke.points,
      );
      const left = buildStickManStrokes({ ...WALKING, walkCycle, facing: -1 }).flatMap(
        (stroke) => stroke.points,
      );
      const mirror = convertToPixels(WALKING.feet.x);
      // The head is a circle drawn the same way round whichever way the stick man faces, so compare what it covers.
      expect(Math.min(...left.map((point) => point.x))).toBeCloseTo(
        2 * mirror - Math.max(...right.map((point) => point.x)),
        6,
      );
      expect(Math.max(...left.map((point) => point.x))).toBeCloseTo(
        2 * mirror - Math.min(...right.map((point) => point.x)),
        6,
      );
      expect(left.map((point) => point.y)).toEqual(right.map((point) => point.y));
    }
  });
});

describe('the stick man jumping', () => {
  it("has the stick man's lower foot exactly where the sim says the stick man's feet are, all the way up and down", () => {
    for (const rise of [1, 0.5, 0, -0.5, -1]) {
      const { legs } = getSkeleton({ ...JUMPING, rise });
      expect(Math.max(...legs.map((leg) => leg[2]!.y))).toBeCloseTo(JUMPING.feet.y, 6);
    }
  });

  it("tucks the stick man's legs most at the top, and reaches for the floor with them on the way down", () => {
    const getHipAbove = (rise: number): number =>
      JUMPING.feet.y - getSkeleton({ ...JUMPING, rise }).hip.y;
    expect(getHipAbove(0)).toBeLessThan(getHipAbove(1));
    expect(getHipAbove(1)).toBeLessThan(getHipAbove(-1));
  });

  it("has the stick man's hands highest at the top, and lower again before the stick man lands", () => {
    const getHandsAbove = (rise: number): number => {
      const { arms, neck } = getSkeleton({ ...JUMPING, rise });
      return neck.y - Math.min(...arms.map((arm) => arm[2]!.y));
    };
    expect(getHandsAbove(0)).toBeGreaterThan(getHandsAbove(1));
    expect(getHandsAbove(0)).toBeGreaterThan(getHandsAbove(-1));
  });

  it('is standing when the stick man is not in the air at all, and something in between on the way there', () => {
    const getJointsAt = (airborneShare: number): number[] =>
      buildStickManStrokes({ ...JUMPING, feet: STANDING.feet, airborneShare }).flatMap((stroke) =>
        stroke.points.map((point) => point.y),
      );
    expect(getJointsAt(0)).toEqual(
      buildStickManStrokes({ ...STANDING, action: 'jumping' }).flatMap((stroke) =>
        stroke.points.map((point) => point.y),
      ),
    );
    expect(getJointsAt(0.5)).not.toEqual(getJointsAt(0));
    expect(getJointsAt(0.5)).not.toEqual(getJointsAt(1));
  });

  it('does not look like standing or walking', () => {
    expect(buildStickManStrokes(JUMPING)).not.toEqual(
      buildStickManStrokes({ ...STANDING, feet: JUMPING.feet }),
    );
    expect(buildStickManStrokes(JUMPING)).not.toEqual(
      buildStickManStrokes({ ...WALKING, feet: JUMPING.feet }),
    );
  });

  it("comes from the stick man's walk when the stick man jumps while walking", () => {
    const midStride = { ...JUMPING, isStriding: true, walkCycle: 0.3, airborneShare: 0 };
    expect(getSkeleton(midStride).legs).toEqual(
      getSkeleton({ ...WALKING, feet: JUMPING.feet, walkCycle: 0.3 }).legs,
    );
  });
});

describe('the stick man landing', () => {
  it("bends the stick man's knees with the stick man's feet still on the floor, deeper the harder into the landing the stick man is", () => {
    const getHipAbove = (landing: number): number =>
      STANDING.feet.y - getSkeleton({ ...STANDING, landing }).hip.y;
    expect(getHipAbove(1)).toBeLessThan(getHipAbove(0.5));
    expect(getHipAbove(0.5)).toBeLessThan(getHipAbove(0));
    for (const leg of getSkeleton({ ...STANDING, landing: 1 }).legs) {
      expect(leg[2]!.y).toBeCloseTo(STANDING.feet.y, 6);
    }
  });
});

describe('poses eased over time', () => {
  it('gets into the jump over a few frames instead of at once, and never moves where the stick man is', () => {
    const poseFor = easePosesOverTime();
    poseFor(ON_FLOOR, FRAME, NO_FLOOR);
    const first = poseFor(GOING_UP, FRAME, NO_FLOOR);
    expect(first.feet).toEqual(GOING_UP.feet);
    expect(first.airborneShare).toBeGreaterThan(0);
    expect(first.airborneShare).toBeLessThan(0.2);
    let pose = first;
    for (let frame = 0; frame < countFramesIn(EASING.takeoffSeconds); frame += 1) {
      const next = poseFor(GOING_UP, FRAME, NO_FLOOR);
      expect(next.airborneShare).toBeGreaterThanOrEqual(pose.airborneShare);
      pose = next;
    }
    expect(pose.airborneShare).toBe(1);
  });

  it("takes the landing with a knee bend that eases out, while the stick man's limbs come back from the jump", () => {
    const poseFor = easePosesOverTime();
    poseFor(ON_FLOOR, FRAME, NO_FLOOR);
    for (let frame = 0; frame < 30; frame += 1) {
      poseFor(COMING_DOWN, FRAME, NO_FLOOR);
    }
    const touchdown = poseFor(ON_FLOOR, FRAME, NO_FLOOR);
    expect(touchdown.landing).toBe(1);
    expect(touchdown.airborneShare).toBeGreaterThan(0.8);
    const soonAfter = poseFor(ON_FLOOR, FRAME, NO_FLOOR);
    expect(soonAfter.landing).toBeLessThan(1);
    expect(soonAfter.airborneShare).toBeLessThan(touchdown.airborneShare);
    let pose = soonAfter;
    for (let frame = 0; frame < countFramesIn(EASING.landing); frame += 1) {
      pose = poseFor(ON_FLOOR, FRAME, NO_FLOOR);
    }
    expect(pose).toEqual(getPose(ON_FLOOR));
  });

  it("does not bend the stick man's knees when the stick man was not coming down: a level that starts again just shows the stick man standing", () => {
    const poseFor = easePosesOverTime();
    poseFor(ON_FLOOR, FRAME, NO_FLOOR);
    poseFor({ ...COMING_DOWN, feet: { x: -1, y: 6 } }, FRAME, NO_FLOOR);
    expect(poseFor(ON_FLOOR, FRAME, NO_FLOOR)).toEqual(getPose(ON_FLOOR));
  });
});

describe('the stick man in a long fall', () => {
  it("throws the stick man's arms up and out once the stick man falls faster than a jump lands, and not before", () => {
    const getHandsAboveShoulders = (verticalSpeed: number): number => {
      const { arms } = getSkeleton(getPose({ ...FALLING, verticalSpeed }));
      return Math.min(...arms.map((arm) => arm[0]!.y - arm[2]!.y));
    };
    expect(getPose({ ...FALLING, verticalSpeed: BODY.longFallSpeed.start }).longFall).toBe(0);
    expect(getHandsAboveShoulders(BODY.longFallSpeed.start)).toBeLessThan(0);
    expect(getPose({ ...FALLING, verticalSpeed: BODY.longFallSpeed.end + 5 }).longFall).toBe(1);
    expect(getHandsAboveShoulders(BODY.longFallSpeed.end)).toBeGreaterThan(0.1);
    const { arms, neck } = getSkeleton(
      getPose({ ...FALLING, verticalSpeed: BODY.longFallSpeed.end }),
    );
    expect(arms[0]![2]!.x).toBeLessThan(neck.x - 0.3);
    expect(arms[1]![2]!.x).toBeGreaterThan(neck.x + 0.3);
  });

  it("starts just above the speed the game's held jump lands at, and is all the way in before the stick man's fastest fall", () => {
    const { fallGravity, jumpHeight, fastestFall } = MOVEMENT_PRESETS.current;
    const landsAt = Math.sqrt(2 * fallGravity * jumpHeight);
    expect(BODY.longFallSpeed.start).toBeGreaterThan(landsAt);
    expect(BODY.longFallSpeed.start).toBeLessThan(landsAt * 1.05);
    expect(BODY.longFallSpeed.end).toBeLessThanOrEqual(fastestFall);
  });

  it("is not what the stick man does on the floor, however the sim has the stick man's speed", () => {
    expect(getPose({ ...ON_FLOOR, verticalSpeed: 20 }).longFall).toBe(0);
  });
});

describe('the stick man falling sideways', () => {
  it('tips the way the stick man drifts, more the faster the stick man drifts against how fast the stick man falls, and stays upright dropping straight', () => {
    const getTiltAt = (horizontalSpeed: number, verticalSpeed: number): number =>
      getPose({ ...FALLING, horizontalSpeed, verticalSpeed }).tilt;
    expect(getTiltAt(0, 4)).toBe(0);
    expect(getTiltAt(2, 4)).toBeGreaterThan(0);
    expect(getTiltAt(-2, 4)).toBeCloseTo(-getTiltAt(2, 4), 9);
    expect(getTiltAt(2, 4)).toBeGreaterThan(getTiltAt(1, 4));
    expect(getTiltAt(2, 4)).toBeGreaterThan(getTiltAt(2, 8));
    expect(getTiltAt(2, 4)).toBeLessThanOrEqual(BODY.fallTilt);
  });

  it('is upright on the floor, however fast the stick man goes sideways', () => {
    expect(getPose({ ...ON_FLOOR, action: 'walking', horizontalSpeed: 2 }).tilt).toBe(0);
  });

  it('is not tipped by a jump, forward or back, on the way up or on the way down', () => {
    for (const horizontalSpeed of [2, -2]) {
      expect(getPose({ ...GOING_UP, horizontalSpeed }).tilt).toBe(0);
      expect(getPose({ ...COMING_DOWN, horizontalSpeed }).tilt).toBe(0);
      expect(buildStickManStrokes(getPose({ ...COMING_DOWN, horizontalSpeed, facing: 1 }))).toEqual(
        buildStickManStrokes(getPose({ ...COMING_DOWN, horizontalSpeed: 0, facing: 1 })),
      );
    }
  });

  it('has only begun to tip when the fall has only begun', () => {
    expect(getPose({ ...FALLING, horizontalSpeed: 2, verticalSpeed: 0.2 }).tilt).toBeLessThan(
      getPose({ ...FALLING, horizontalSpeed: 2, verticalSpeed: 2 }).tilt / 3,
    );
  });

  it("puts the stick man's head ahead of the stick man's hips and the stick man's feet behind them, with the stick man's lower foot still where the sim says", () => {
    for (const facing of [1, -1] as const) {
      const upright = getSkeleton({ ...JUMPING, rise: -1, facing });
      const tipped = getSkeleton({ ...JUMPING, rise: -1, facing, tilt: 0.3 });
      expect(tipped.head.x - tipped.hip.x).toBeGreaterThan(upright.head.x - upright.hip.x + 0.1);
      for (const leg of [0, 1]) {
        expect(tipped.legs[leg]![2]!.x).toBeLessThan(upright.legs[leg]![2]!.x);
      }
      expect(Math.max(...tipped.legs.map((leg) => leg[2]!.y))).toBeCloseTo(JUMPING.feet.y, 6);
    }
  });

  it('tips over a few frames, and comes back upright over a few once the stick man has landed', () => {
    const poseFor = easePosesOverTime();
    const falling = { ...FALLING, horizontalSpeed: 2, verticalSpeed: 3 };
    poseFor(falling, FRAME, NO_FLOOR);
    const first = poseFor(falling, FRAME, NO_FLOOR).tilt;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(getPose(falling).tilt);
    for (let frame = 0; frame < 30; frame += 1) {
      poseFor(falling, FRAME, NO_FLOOR);
    }
    expect(poseFor(falling, FRAME, NO_FLOOR).tilt).toBeCloseTo(getPose(falling).tilt, 9);
    expect(poseFor({ ...ON_FLOOR, feet: falling.feet }, FRAME, NO_FLOOR).tilt).toBeGreaterThan(0);
    for (let frame = 0; frame < 30; frame += 1) {
      poseFor({ ...ON_FLOOR, feet: falling.feet }, FRAME, NO_FLOOR);
    }
    expect(poseFor({ ...ON_FLOOR, feet: falling.feet }, FRAME, NO_FLOOR).tilt).toBe(0);
  });
});

describe('the stick man dropping past the end of a floor line', () => {
  it('is left as the stick man is when nothing of the stick man is near a line', () => {
    const pose = { ...DROPPING, feet: { x: LINE_END + 2, y: 0.5 } };
    expect(keepOffFloor(pose, FLOOR)).toEqual(pose);
  });

  it("never has an arm, the stick man's body or the stick man's head across the line, all the way down beside it", () => {
    for (const facing of [1, -1] as const) {
      for (const feet of DROP_BESIDE_END) {
        const skeleton = getSkeleton(keepOffFloor({ ...DROPPING, facing, feet }, FLOOR));
        for (const arm of skeleton.arms) {
          expect(
            measureDistanceBetweenLines([arm[0]!, arm[1]!], LINE),
            `arm at feet y ${feet.y}`,
          ).toBeGreaterThan(0);
          expect(
            measureDistanceBetweenLines([arm[1]!, arm[2]!], LINE),
            `forearm at feet y ${feet.y}`,
          ).toBeGreaterThan(0);
        }
        expect(measureDistanceBetweenLines([skeleton.neck, skeleton.hip], LINE)).toBeGreaterThan(0);
        expect(measureDistanceBetweenLines([skeleton.head, skeleton.head], LINE)).toBeGreaterThan(
          BODY.headRadius,
        );
      }
    }
  });

  it('holds the arm that would cross on the line: lifted no more than it takes, so the arm rests on it', () => {
    const lifts = DROP_BESIDE_END.map((feet) => keepOffFloor({ ...DROPPING, feet }, FLOOR));
    const held = lifts.filter((pose) => pose.armsLifted[BACK_ARM] > 0);
    expect(held.length).toBeGreaterThan(3);
    for (const pose of held) {
      const [shoulder, elbow, hand] = getSkeleton(pose).arms[BACK_ARM]!;
      const fromLine = Math.min(
        measureDistanceBetweenLines([shoulder!, elbow!], LINE),
        measureDistanceBetweenLines([elbow!, hand!], LINE),
      );
      expect(fromLine).toBeLessThan(LINE_CLEARANCE + 0.03);
    }
  });

  it("pushes the held arm further up as the stick man drops, then lets it go once the stick man's shoulder is under the line", () => {
    const lifts = DROP_BESIDE_END.map(
      (feet) => keepOffFloor({ ...DROPPING, feet }, FLOOR).armsLifted[BACK_ARM],
    );
    const firstHeld = lifts.findIndex((lift) => lift > 0);
    const lastHeld = lifts.length - 1 - [...lifts].reverse().findIndex((lift) => lift > 0);
    expect(firstHeld).toBeGreaterThan(0);
    for (let drop = firstHeld + 1; drop <= lastHeld; drop += 1) {
      expect(lifts[drop]).toBeGreaterThanOrEqual(lifts[drop - 1]!);
    }
    expect(lifts[lastHeld]).toBeGreaterThan(lifts[firstHeld]! + 0.3);
    expect(lifts.slice(lastHeld + 1).length).toBeGreaterThan(0);
    const shoulderWhenLetGo = getSkeleton({ ...DROPPING, feet: DROP_BESIDE_END[lastHeld + 1]! })
      .arms[BACK_ARM]![0]!;
    // By then the stick man's arm reaches round the end of the line and under it.
    expect(shoulderWhenLetGo.y).toBeGreaterThan(LINE[0].y - BODY.upperArm);
  });

  it('leaves the arm on the other side of the stick man where it was', () => {
    for (const feet of DROP_BESIDE_END) {
      expect(keepOffFloor({ ...DROPPING, feet }, FLOOR).armsLifted[1 - BACK_ARM]).toBe(0);
    }
  });

  it("tips the stick man less, or not at all, when tipping would put the stick man's head across a line", () => {
    const towardsLine = { ...DROPPING, feet: { x: BESIDE_END, y: 1.5 }, tilt: -0.5 };
    const kept = keepOffFloor(towardsLine, FLOOR);
    expect(kept.tilt).toBeGreaterThan(towardsLine.tilt);
    expect(kept.tilt).toBeLessThanOrEqual(0);
    const awayFromLine = { ...towardsLine, tilt: 0.5 };
    expect(keepOffFloor(awayFromLine, FLOOR).tilt).toBe(0.5);
  });

  it("fits inside the width the sim keeps clear of a line: the stick man's head, with the room a pencil line takes", () => {
    expect(BODY.headRadius + LINE_CLEARANCE).toBeLessThan(STICK_MAN_WIDTH / 2);
  });

  it("has nothing but the stick man's feet across a line in any fall the sim gives the stick man, on every level, at one frame a tick and at one every three", () => {
    for (const level of levels) {
      for (const ticksPerFrame of [1, 3]) {
        for (const keys of WAYS_TO_FALL) {
          const sim = createSim({ level: level.id });
          const poseFor = easePosesOverTime();
          for (let tick = 0; tick < 420 && sim.level === level.id; tick += 1) {
            sim.step(keys(tick));
            if (tick % ticksPerFrame !== 0) {
              continue;
            }
            const stickMan = getStickMan(sim);
            const { head, neck, hip, arms } = getSkeleton(
              poseFor(stickMan, ticksPerFrame * FRAME, level.floor),
            );
            if (stickMan.action !== 'jumping') {
              continue;
            }
            const context = `level ${level.id}, tick ${tick}, feet (${stickMan.feet.x.toFixed(3)}, ${stickMan.feet.y.toFixed(3)})`;
            for (const { start, end } of level.floor) {
              for (const arm of arms) {
                expect(
                  measureDistanceBetweenLines([arm[0]!, arm[1]!], [start, end]),
                  `upper arm, ${context}`,
                ).toBeGreaterThan(0);
                expect(
                  measureDistanceBetweenLines([arm[1]!, arm[2]!], [start, end]),
                  `forearm, ${context}`,
                ).toBeGreaterThan(0);
              }
              expect(
                measureDistanceBetweenLines([neck, hip], [start, end]),
                `body, ${context}`,
              ).toBeGreaterThan(0);
              expect(
                measureDistanceBetweenLines([head, head], [start, end]),
                `head, ${context}`,
              ).toBeGreaterThan(BODY.headRadius);
            }
          }
        }
      }
    }
  });

  it('lets the arm come down over a few frames once the line lets go, never across the line on the way', () => {
    const poseFor = easePosesOverTime();
    const shown = DROP_BESIDE_END.map((feet) => poseFor({ ...FALLING, feet }, FRAME, FLOOR));
    const lifts = shown.map((pose) => pose.armsLifted[BACK_ARM]);
    expect(Math.max(...lifts)).toBeGreaterThan(0.3);
    expect(lifts[lifts.length - 1]).toBe(0);
    for (let frame = 1; frame < lifts.length; frame += 1) {
      expect(lifts[frame - 1]! - lifts[frame]!).toBeLessThanOrEqual(
        FRAME * EASING.armComesDownPerSecond + 1e-9,
      );
    }
    for (const pose of shown) {
      const [shoulder, elbow, hand] = getSkeleton(pose).arms[BACK_ARM]!;
      expect(measureDistanceBetweenLines([shoulder!, elbow!], LINE)).toBeGreaterThan(0);
      expect(measureDistanceBetweenLines([elbow!, hand!], LINE)).toBeGreaterThan(0);
    }
  });
});

describe('the stick man cheering', () => {
  it("stands with both hands up beside the stick man's head, higher than the stick man's neck", () => {
    const { arms, legs, head } = getSkeleton({ ...STANDING, action: 'cheering' });
    for (const arm of arms) {
      expect(arm[2]!.y).toBeLessThan(head.y);
    }
    expect(arms[0]![2]!.x).toBeLessThan(head.x - BODY.headRadius);
    expect(arms[1]![2]!.x).toBeGreaterThan(head.x + BODY.headRadius);
    expect(legs).toEqual(getSkeleton(STANDING).legs);
  });
});

describe('the stick man carrying something over its head', () => {
  it("holds both hands up at the height of the top of the stick man, one to each side, elbows out past the stick man's head", () => {
    for (const pose of [
      STANDING,
      WALKING,
      { ...WALKING, walkCycle: 0.3 },
      { ...STANDING, facing: -1 as const },
    ]) {
      const { arms, head } = getSkeleton({ ...pose, carrying: 1 });
      const [back, front] = arms.map(([, elbow, hand]) => ({ elbow: elbow!, hand: hand! }));
      for (const { hand } of [back!, front!]) {
        expect(hand.y).toBeCloseTo(pose.feet.y - STICK_MAN_HEIGHT, 9);
      }
      expect((front!.hand.x - pose.feet.x) * pose.facing).toBeGreaterThan(0);
      expect((back!.hand.x - pose.feet.x) * pose.facing).toBeLessThan(0);
      for (const { elbow } of [back!, front!]) {
        expect(Math.hypot(elbow.x - head.x, elbow.y - head.y)).toBeGreaterThan(BODY.headRadius);
      }
    }
  });

  it("leaves the stick man's arms where they would be when the stick man carries nothing", () => {
    expect(getSkeleton({ ...WALKING, carrying: 0 })).toEqual(getSkeleton(WALKING));
  });

  it("takes a moment to get the stick man's arms up when the stick man lifts, and to bring them down again", () => {
    const poseFor = easePosesOverTime();
    poseFor(ON_FLOOR, FRAME, NO_FLOOR);
    const lifting = poseFor({ ...ON_FLOOR, isCarrying: true }, FRAME, NO_FLOOR);
    expect(lifting.carrying).toBeGreaterThan(0);
    expect(lifting.carrying).toBeLessThan(1);
    let pose = lifting;
    for (let frame = 0; frame < countFramesIn(EASING.armsUpAndDown); frame += 1) {
      pose = poseFor({ ...ON_FLOOR, isCarrying: true }, FRAME, NO_FLOOR);
    }
    expect(pose.carrying).toBe(1);
    expect(poseFor(ON_FLOOR, FRAME, NO_FLOOR).carrying).toBeLessThan(1);
  });
});

describe('the pose for what the sim says', () => {
  it('keeps where the stick man is, which way the stick man faces and what the stick man is doing', () => {
    expect(getPose(view)).toMatchObject({ feet: view.feet, facing: -1, action: 'walking' });
  });

  it('goes through one walk cycle per cycle length walked', () => {
    expect(getPose({ ...view, distanceWalked: getWalkCycleLength() * 0.25 }).walkCycle).toBeCloseTo(
      0.25,
      6,
    );
    expect(getPose({ ...view, distanceWalked: getWalkCycleLength() * 3.5 }).walkCycle).toBeCloseTo(
      0.5,
      6,
    );
  });

  it('rises while the stick man moves up and falls while the stick man moves down, never past 1', () => {
    expect(getPose({ ...view, verticalSpeed: -100 }).rise).toBe(1);
    expect(getPose({ ...view, verticalSpeed: 100 }).rise).toBe(-1);
    expect(getPose({ ...view, verticalSpeed: 0 }).rise).toBeCloseTo(0, 6);
    expect(getPose({ ...view, verticalSpeed: -1 }).rise).toBeGreaterThan(0);
  });
});

describe('seated in the airplane', () => {
  it('sits on it: hips just above where the sim has the stick man, knees up and feet out in front, head on top, well under its standing height', () => {
    for (const facing of [1, -1] as const) {
      const { head, neck, hip, legs, arms } = getSkeleton({ ...SEATED, facing });
      expect(hip.y).toBeLessThan(SEATED.feet.y);
      expect(SEATED.feet.y - hip.y).toBeLessThan(0.2 * STICK_MAN_HEIGHT);
      expect(neck.y).toBeLessThan(hip.y);
      expect(head.y).toBeLessThan(neck.y);
      expect(SEATED.feet.y - head.y + BODY.headRadius).toBeLessThan(0.75 * STICK_MAN_HEIGHT);
      // The stick man leans into the flight.
      expect((head.x - hip.x) * facing).toBeGreaterThan(0);
      for (const [top, knee, foot] of legs) {
        expect(top).toEqual(hip);
        expect((knee!.x - hip.x) * facing).toBeGreaterThan(0);
        expect(knee!.y).toBeLessThan(hip.y);
        expect((foot!.x - knee!.x) * facing).toBeGreaterThan(0);
        // The stick man's feet rest on it, at about the height the stick man sits at.
        expect(Math.abs(foot!.y - SEATED.feet.y)).toBeLessThan(0.1 * STICK_MAN_HEIGHT);
      }
      for (const [, , hand] of arms) {
        expect((hand!.x - hip.x) * facing).toBeGreaterThan(0);
        expect(hand!.y).toBeLessThan(SEATED.feet.y);
        expect(hand!.y).toBeGreaterThan(neck.y);
      }
    }
  });

  it('is the same man mirrored when the stick man faces the other way', () => {
    const right = getSkeleton({ ...SEATED, facing: 1 });
    const left = getSkeleton({ ...SEATED, facing: -1 });
    expect(left.head.x - SEATED.feet.x).toBeCloseTo(-(right.head.x - SEATED.feet.x), 9);
    expect(left.head.y).toBeCloseTo(right.head.y, 9);
    expect(left.legs[0]![2]!.x - SEATED.feet.x).toBeCloseTo(
      -(right.legs[0]![2]!.x - SEATED.feet.x),
      9,
    );
  });

  it('tips with what the stick man sits in, all of the stick man, about the point it turns about', () => {
    for (const facing of [1, -1] as const) {
      const level = getSkeleton({ ...SEATED, facing });
      const noseUp = getSkeleton(
        seatIn({ ...SEATED, facing }, { noseDown: -0.5, tipsAboutAbove: 0.17 }),
      );
      const noseDown = getSkeleton(
        seatIn({ ...SEATED, facing }, { noseDown: 0.5, tipsAboutAbove: 0.17 }),
      );
      // Nose up the stick man tips back, nose down it tips forward; its limbs keep their length.
      expect((noseUp.head.x - level.head.x) * facing).toBeLessThan(0);
      expect((noseDown.head.x - level.head.x) * facing).toBeGreaterThan(0);
      const pivot = { x: SEATED.feet.x, y: SEATED.feet.y - 0.17 };
      for (const joint of ['head', 'neck', 'hip'] as const) {
        expect(Math.hypot(noseUp[joint].x - pivot.x, noseUp[joint].y - pivot.y)).toBeCloseTo(
          Math.hypot(level[joint].x - pivot.x, level[joint].y - pivot.y),
          9,
        );
      }
      for (const limbs of ['arms', 'legs'] as const) {
        noseUp[limbs].forEach((limb, limbIndex) =>
          limb.forEach((joint, jointIndex) => {
            const untipped = level[limbs][limbIndex]![jointIndex]!;
            expect(Math.hypot(joint.x - pivot.x, joint.y - pivot.y)).toBeCloseTo(
              Math.hypot(untipped.x - pivot.x, untipped.y - pivot.y),
              9,
            );
            if (Math.hypot(untipped.x - pivot.x, untipped.y - pivot.y) > 0.05) {
              expect(joint).not.toEqual(untipped);
            }
          }),
        );
      }
      expect(Math.hypot(noseUp.neck.x - noseUp.hip.x, noseUp.neck.y - noseUp.hip.y)).toBeCloseTo(
        BODY.body,
        9,
      );
    }
  });

  it('is only for a seated man: any other pose is left as it is', () => {
    expect(seatIn(STANDING, { noseDown: 0.5, tipsAboutAbove: 0.17 })).toBe(STANDING);
    expect(seatIn(JUMPING, { noseDown: 0.5, tipsAboutAbove: 0.17 })).toBe(JUMPING);
  });

  it('comes from the sim as a pose that is level until the scene tips it, and is drawn as a head and five lines like any other', () => {
    const pose = getPose({ ...ON_FLOOR, action: 'seated' });
    expect(pose).toMatchObject({ action: 'seated', tilt: 0, tipsAboutAbove: 0 });
    const strokes = buildStickManStrokes(pose);
    expect(strokes).toHaveLength(6);
    expect(strokes[0]).toMatchObject({ isClosed: true });
  });

  it('is not eased into or kept off the floor: seated, the stick man is drawn where the airplane is from the first frame', () => {
    const poseFor = easePosesOverTime();
    poseFor(ON_FLOOR, FRAME, NO_FLOOR);
    const seated = {
      ...ON_FLOOR,
      action: 'seated' as const,
      feet: { x: ON_FLOOR.feet.x + 0.1, y: ON_FLOOR.feet.y },
    };
    expect(poseFor(seated, FRAME, NO_FLOOR)).toMatchObject({
      action: 'seated',
      feet: seated.feet,
      tilt: 0,
    });
  });
});

// ---- Helpers ----

const SEATED: StickManPose = {
  feet: { x: 12, y: -1.5 },
  facing: 1,
  action: 'seated',
  walkCycle: 0,
  rise: 0,
  longFall: 0,
  isStriding: false,
  airborneShare: 0,
  landing: 0,
  tilt: 0,
  tipsAboutAbove: 0,
  armsLifted: [0, 0],
  carrying: 0,
};

const STANDING: StickManPose = {
  feet: { x: 3, y: 0.5 },
  facing: 1,
  action: 'standing',
  walkCycle: 0,
  rise: 0,
  longFall: 0,
  isStriding: false,
  airborneShare: 0,
  landing: 0,
  tilt: 0,
  tipsAboutAbove: 0,
  armsLifted: [0, 0],
  carrying: 0,
};
const WALKING: StickManPose = {
  feet: { x: 3, y: 0.5 },
  facing: 1,
  action: 'walking',
  walkCycle: 0,
  rise: 0,
  longFall: 0,
  isStriding: true,
  airborneShare: 0,
  landing: 0,
  tilt: 0,
  tipsAboutAbove: 0,
  armsLifted: [0, 0],
  carrying: 0,
};
const JUMPING: StickManPose = {
  feet: { x: 3, y: 0.2 },
  facing: 1,
  action: 'jumping',
  walkCycle: 0,
  rise: 1,
  longFall: 0,
  isStriding: false,
  airborneShare: 1,
  landing: 0,
  tilt: 0,
  tipsAboutAbove: 0,
  armsLifted: [0, 0],
  carrying: 0,
};
const view = {
  feet: { x: 3, y: 0.5 },
  facing: -1,
  action: 'walking',
  distanceWalked: 0,
  verticalSpeed: 0,
  horizontalSpeed: 0,
  isFallingOffEdge: false,
  walkDirectionAsked: -1,
  isCarrying: false,
} as const;
const ON_FLOOR = {
  feet: { x: 3, y: 0 },
  facing: 1,
  action: 'standing',
  distanceWalked: 0,
  verticalSpeed: 0,
  horizontalSpeed: 0,
  isFallingOffEdge: false,
  walkDirectionAsked: 0,
  isCarrying: false,
} as const;
const GOING_UP = {
  ...ON_FLOOR,
  feet: { x: 3, y: -0.2 },
  action: 'jumping',
  verticalSpeed: -5,
} as const;
const COMING_DOWN = {
  ...ON_FLOOR,
  feet: { x: 3, y: -0.2 },
  action: 'jumping',
  verticalSpeed: 4,
} as const;
/** In the air because the stick man walked off an edge. */
const FALLING = { ...COMING_DOWN, horizontalSpeed: 0, isFallingOffEdge: true } as const;
/** A floor line that ends at `LINE_END`, with the stick man dropping on the open side of it, as close as the sim lets the stick man: half the stick man's width away. */
const LINE_END = 6;
const FLOOR = [{ start: { x: 0, y: 0 }, end: { x: LINE_END, y: 0 } }];
const LINE = [FLOOR[0]!.start, FLOOR[0]!.end] as const;
/** Coming down facing away from the line, so the stick man's back arm is the one over it. */
const BESIDE_END = LINE_END + STICK_MAN_WIDTH / 2;
const DROPPING: StickManPose = {
  feet: { x: BESIDE_END, y: 0 },
  facing: 1,
  action: 'jumping',
  walkCycle: 0,
  rise: -1,
  longFall: 0,
  isStriding: false,
  airborneShare: 1,
  landing: 0,
  tilt: 0,
  tipsAboutAbove: 0,
  armsLifted: [0, 0],
  carrying: 0,
};
const BACK_ARM = 0;
/** The stick man's feet from the line's height to well below it, in small steps: slower than the stick man ever falls, so every moment of the hold is looked at. */
const DROP_BESIDE_END = Array.from({ length: 80 }, (_, step) => ({
  x: BESIDE_END,
  y: step * 0.03,
}));
const makeWalk = (direction: -1 | 0 | 1): Command => ({ type: 'player/walk', direction });
const JUMP: Command = { type: 'player/jump' };
/** The keys, tick by tick, of the falls a player gets into: off either way, letting go, steering back, hopping at an edge, jumping short. */
const WAYS_TO_FALL: readonly ((tick: number) => Command[])[] = [
  (tick) => (tick === 0 ? [makeWalk(1)] : []),
  (tick) => (tick === 0 ? [makeWalk(-1)] : []),
  (tick) => (tick === 0 ? [makeWalk(1)] : tick === 112 ? [makeWalk(0)] : []),
  (tick) => (tick === 0 ? [makeWalk(1)] : tick === 112 ? [makeWalk(-1)] : []),
  (tick) => (tick === 0 ? [makeWalk(-1)] : tick === 57 ? [makeWalk(1)] : []),
  (tick) =>
    tick === 0
      ? [makeWalk(1)]
      : tick === 106
        ? [makeWalk(0)]
        : tick === 120
          ? [JUMP, makeWalk(1)]
          : tick === 123
            ? [makeWalk(0)]
            : [],
  (tick) => (tick === 0 ? [makeWalk(1)] : tick === 80 ? [JUMP] : []),
  (tick) =>
    tick === 0 ? [makeWalk(1)] : tick === 100 ? [JUMP] : tick === 110 ? [makeWalk(0)] : [],
  (tick) =>
    tick === 0
      ? [makeWalk(-1)]
      : tick === 50
        ? [makeWalk(0)]
        : tick === 60
          ? [JUMP, makeWalk(-1)]
          : tick === 64
            ? [makeWalk(0)]
            : [],
];
const FRAME = 1 / 60;
const NO_FLOOR: readonly FloorSegment[] = [];
const countFramesIn = (seconds: number): number => Math.ceil(seconds / FRAME) + 1;
const CYCLE_SAMPLES = Array.from({ length: 40 }, (_, sample) => sample / 40);
