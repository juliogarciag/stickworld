import { STICK_MAN_HEIGHT, type Point } from '@stickworld/sim';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { toPixels } from './units';

/**
 * The stick man as pencil strokes: a head, a body, two arms and two legs,
 * worked out from code every frame. What he is doing and how far along comes
 * from outside (the sim, once walking is a rule); which way each limb points
 * is decided here and nowhere else.
 */

export interface StickManPose {
  /** Where his feet are on the floor, in metres. */
  readonly feet: Point;
  /** 1 when he looks right, -1 when he looks left. */
  readonly facing: 1 | -1;
  readonly action: 'standing' | 'walking';
  /** How far along one walk cycle (two steps) he is, from 0 to 1; at 0 a foot has just come down in front of him. Ignored when standing. */
  readonly walkCycle: number;
}

/** The strokes that draw the stick man in `pose`, in world pixels. */
export function stickManStrokes(pose: StickManPose): Stroke[] {
  const { head, neck, hip, arms, legs } = skeletonOf(pose);
  const lines = [[neck, hip], ...arms, ...legs];
  return [
    { points: circleAround(head, BODY.headRadius).map(inPixels), thickness: PENCIL.thickness, closed: true },
    ...lines.map((line) => ({ points: line.map(inPixels), thickness: PENCIL.thickness })),
  ];
}

/**
 * How far he travels in one walk cycle (two steps), in metres: the distance at
 * which his planted foot does not slide. It follows from his proportions, which
 * are view detail. When walking becomes a sim rule (issue #2), the sim cannot
 * read this: either its tuning names the same length, or the view works the
 * cycle out from the distance the sim says he has walked.
 */
export function walkCycleLength(): number {
  return 4 * STEP_REACH;
}

// ---- Helpers ----

/** His proportions, as shares of his height, and how far his limbs swing, in radians. View detail only. */
const BODY = {
  headRadius: 0.1 * STICK_MAN_HEIGHT,
  body: 0.31 * STICK_MAN_HEIGHT,
  thigh: 0.235 * STICK_MAN_HEIGHT,
  shin: 0.235 * STICK_MAN_HEIGHT,
  upperArm: 0.15 * STICK_MAN_HEIGHT,
  forearm: 0.15 * STICK_MAN_HEIGHT,
  /** How far below the neck the arms start. */
  shoulderDrop: 0.03 * STICK_MAN_HEIGHT,
  thighSwing: 0.46,
  kneeBend: 1.1,
  /** How much further forward the thigh is in the middle of its swing, so the knee leads the foot. */
  kneeLift: 0.3,
  restingKnee: 0.06,
  armSwing: 0.5,
  elbowBend: 0.35,
  restingArm: 0.12,
  lean: 0.07,
} as const;

/** How far in front of his hips a foot comes down, and how far behind it lifts off, in metres. */
const STEP_REACH = (BODY.thigh + BODY.shin) * Math.sin(BODY.thighSwing);

interface Skeleton {
  readonly head: Point;
  readonly neck: Point;
  readonly hip: Point;
  readonly arms: readonly Point[][];
  readonly legs: readonly Point[][];
}

interface LimbCycle {
  readonly facing: 1 | -1;
  /** Where this limb is in the walk cycle, from 0 to 1. */
  readonly cycle: number;
  readonly walking: boolean;
}

/** Every joint, in metres. The lower foot is on the floor, so the hips rise and fall as he walks. */
function skeletonOf({ feet, facing, action, walkCycle }: StickManPose): Skeleton {
  const walking = action === 'walking';
  const origin = { x: 0, y: 0 };
  const nearLeg = legFrom(origin, { facing, cycle: walkCycle, walking });
  const farLeg = legFrom(origin, { facing, cycle: walkCycle + 0.5, walking });
  const reach = Math.max(nearLeg[2]!.y, farLeg[2]!.y);
  const hip = { x: feet.x, y: feet.y - reach };
  const lean = walking ? BODY.lean * facing : 0;
  const neck = { x: hip.x + Math.sin(lean) * BODY.body, y: hip.y - Math.cos(lean) * BODY.body };
  const head = { x: neck.x + Math.sin(lean) * BODY.headRadius, y: neck.y - Math.cos(lean) * BODY.headRadius };
  const shoulder = { x: neck.x - Math.sin(lean) * BODY.shoulderDrop, y: neck.y + Math.cos(lean) * BODY.shoulderDrop };
  return {
    head,
    neck,
    hip,
    // Each arm swings with the opposite leg.
    arms: [armFrom(shoulder, { facing, cycle: walkCycle + 0.5, walking, restingSide: -1 }), armFrom(shoulder, { facing, cycle: walkCycle, walking, restingSide: 1 })],
    legs: [legFrom(hip, { facing, cycle: walkCycle, walking }), legFrom(hip, { facing, cycle: walkCycle + 0.5, walking })],
  };
}

/**
 * Hip, knee and foot of one leg. For the first half of its cycle the foot is
 * planted: it goes back under him at the speed he goes forward, on a straight
 * leg. For the second half the leg swings forward again with the knee bent.
 */
function legFrom(hip: Point, { facing, cycle, walking }: LimbCycle): Point[] {
  const within = ((cycle % 1) + 1) % 1;
  let thigh = 0;
  let bend = BODY.restingKnee;
  if (walking && within < 0.5) {
    thigh = Math.asin((STEP_REACH * (1 - 4 * within)) / (BODY.thigh + BODY.shin));
  } else if (walking) {
    const swing = (within - 0.5) * 2;
    thigh = -BODY.thighSwing * Math.cos(Math.PI * swing) + BODY.kneeLift * Math.sin(Math.PI * swing);
    bend += BODY.kneeBend * Math.sin(Math.PI * swing);
  }
  const knee = stepFrom(hip, { angle: thigh, length: BODY.thigh, facing });
  return [hip, knee, stepFrom(knee, { angle: thigh - bend, length: BODY.shin, facing })];
}

/** Shoulder, elbow and hand of one arm, forward when the leg at `cycle` is forward. The elbow always bends forward. Standing, it hangs a little to its `restingSide`: 1 in front of him, -1 behind. */
function armFrom(shoulder: Point, { facing, cycle, walking, restingSide }: LimbCycle & { restingSide: 1 | -1 }): Point[] {
  const turn = cycle * Math.PI * 2;
  const upper = walking ? BODY.armSwing * Math.cos(turn) : BODY.restingArm * restingSide;
  const bend = walking ? BODY.elbowBend * (1 + 0.5 * Math.cos(turn)) : BODY.restingArm;
  const elbow = stepFrom(shoulder, { angle: upper, length: BODY.upperArm, facing });
  return [shoulder, elbow, stepFrom(elbow, { angle: upper + bend, length: BODY.forearm, facing })];
}

/** The point `length` away from `from`, at `angle` from straight down, forward being the way he faces. */
function stepFrom(from: Point, { angle, length, facing }: { angle: number; length: number; facing: 1 | -1 }): Point {
  return { x: from.x + Math.sin(angle) * length * facing, y: from.y + Math.cos(angle) * length };
}

const HEAD_CORNERS = 18;

function circleAround(centre: Point, radius: number): Point[] {
  return Array.from({ length: HEAD_CORNERS }, (_, corner) => {
    // Start at the top, where a hand starts a circle.
    const angle = (corner / HEAD_CORNERS) * Math.PI * 2 - Math.PI / 2;
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
  });
}

const inPixels = (point: Point): StrokePoint => ({ x: toPixels(point.x), y: toPixels(point.y) });

export const __testing__ = { skeletonOf, BODY };
