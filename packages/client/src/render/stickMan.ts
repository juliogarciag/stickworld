import { STICK_MAN_HEIGHT, type Point, type StickManView } from '@stickworld/sim';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { toPixels } from './units';

/**
 * The stick man as pencil strokes: a head, a body, two arms and two legs,
 * worked out from code every frame. What he is doing and how far along comes
 * from the sim; which way each limb points is decided here and nowhere else.
 */

export interface StickManPose {
  /** Where his feet are on the floor, in metres. */
  readonly feet: Point;
  /** 1 when he looks right, -1 when he looks left. */
  readonly facing: 1 | -1;
  readonly action: StickManView['action'];
  /** How far along one walk cycle (two steps) he is, from 0 to 1; at 0 a foot has just come down in front of him. Only read when walking. */
  readonly walkCycle: number;
  /** Which way a jump is going: 1 on the way up, -1 on the way down, between the two around the top. Only read when jumping. */
  readonly rise: number;
}

/** The pose that shows the stick man as the sim has him. */
export function poseOf({ feet, facing, action, distanceWalked, verticalSpeed }: StickManView): StickManPose {
  return {
    feet,
    facing,
    action,
    walkCycle: (distanceWalked / walkCycleLength()) % 1,
    rise: Math.max(-1, Math.min(1, -verticalSpeed / BODY.speedOfFullRise)),
  };
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
 * are view detail, so the sim does not know it: the sim says how far he has
 * walked and `poseOf` works the cycle out from that.
 */
export function walkCycleLength(): number {
  return 4 * STEP_REACH;
}

// ---- Helpers ----

/** His proportions, as shares of his height, and how far his limbs swing, in radians. View detail only. */
const BODY = {
  headRadius: 0.13 * STICK_MAN_HEIGHT,
  body: 0.3 * STICK_MAN_HEIGHT,
  thigh: 0.21 * STICK_MAN_HEIGHT,
  shin: 0.21 * STICK_MAN_HEIGHT,
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
  /** The vertical speed, in metres per second, at which a jump looks fully on its way up or down. */
  speedOfFullRise: 3,
  /** Limbs in a jump, on the way up and on the way down; in between, something in between. */
  jumpingUp: { frontLeg: { swing: 0.85, bend: 1.5 }, backLeg: { swing: -0.1, bend: 0.7 }, frontArm: { swing: 2.3, bend: 0.3 }, backArm: { swing: -0.7, bend: 0.3 } },
  comingDown: { frontLeg: { swing: 0.35, bend: 0.3 }, backLeg: { swing: -0.3, bend: 0.25 }, frontArm: { swing: 1.9, bend: 0.25 }, backArm: { swing: -1.9, bend: -0.25 } },
  /** Both arms up once the level is finished. */
  cheeringArm: { swing: 2.2, bend: 0.3 },
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

/** One limb of two parts: how far its upper part swings from straight down (forward is positive) and how far its joint bends, in radians. */
interface Limb {
  readonly swing: number;
  readonly bend: number;
}

interface Limbs {
  readonly legs: readonly [Limb, Limb];
  readonly arms: readonly [Limb, Limb];
  /** How far his body tips forward. */
  readonly lean: number;
}

/** Every joint, in metres. The lower foot is where the sim says his feet are, so the hips rise and fall as he walks. */
function skeletonOf(pose: StickManPose): Skeleton {
  const { feet, facing } = pose;
  const limbs = limbsOf(pose);
  const origin = { x: 0, y: 0 };
  const reach = Math.max(...limbs.legs.map((leg) => legFrom(origin, leg, facing)[2]!.y));
  const hip = { x: feet.x, y: feet.y - reach };
  const lean = limbs.lean * facing;
  const neck = { x: hip.x + Math.sin(lean) * BODY.body, y: hip.y - Math.cos(lean) * BODY.body };
  const head = { x: neck.x + Math.sin(lean) * BODY.headRadius, y: neck.y - Math.cos(lean) * BODY.headRadius };
  const shoulder = { x: neck.x - Math.sin(lean) * BODY.shoulderDrop, y: neck.y + Math.cos(lean) * BODY.shoulderDrop };
  return { head, neck, hip, arms: limbs.arms.map((arm) => armFrom(shoulder, arm, facing)), legs: limbs.legs.map((leg) => legFrom(hip, leg, facing)) };
}

/** Where every limb points for what he is doing. */
function limbsOf({ action, walkCycle, rise }: StickManPose): Limbs {
  const standingLeg = { swing: 0, bend: BODY.restingKnee };
  if (action === 'walking') {
    // Each arm swings with the opposite leg.
    return { legs: [walkingLeg(walkCycle), walkingLeg(walkCycle + 0.5)], arms: [walkingArm(walkCycle + 0.5), walkingArm(walkCycle)], lean: BODY.lean };
  }
  if (action === 'jumping') {
    const up = (rise + 1) / 2;
    const between = (limb: 'frontLeg' | 'backLeg' | 'frontArm' | 'backArm'): Limb => ({
      swing: BODY.comingDown[limb].swing + (BODY.jumpingUp[limb].swing - BODY.comingDown[limb].swing) * up,
      bend: BODY.comingDown[limb].bend + (BODY.jumpingUp[limb].bend - BODY.comingDown[limb].bend) * up,
    });
    return { legs: [between('frontLeg'), between('backLeg')], arms: [between('backArm'), between('frontArm')], lean: BODY.lean * rise };
  }
  if (action === 'cheering') {
    const { swing, bend } = BODY.cheeringArm;
    return { legs: [standingLeg, standingLeg], arms: [{ swing: -swing, bend: -bend }, { swing, bend }], lean: 0 };
  }
  // Standing, his arms hang a little apart: one behind him, one in front.
  return { legs: [standingLeg, standingLeg], arms: [{ swing: -BODY.restingArm, bend: BODY.restingArm }, { swing: BODY.restingArm, bend: BODY.restingArm }], lean: 0 };
}

/**
 * A leg at `cycle` of the walk. For the first half of its cycle the foot is
 * planted: it goes back under him at the speed he goes forward, on a straight
 * leg. For the second half the leg swings forward again with the knee bent.
 */
function walkingLeg(cycle: number): Limb {
  const within = ((cycle % 1) + 1) % 1;
  if (within < 0.5) return { swing: Math.asin((STEP_REACH * (1 - 4 * within)) / (BODY.thigh + BODY.shin)), bend: BODY.restingKnee };
  const swung = (within - 0.5) * 2;
  return {
    swing: -BODY.thighSwing * Math.cos(Math.PI * swung) + BODY.kneeLift * Math.sin(Math.PI * swung),
    bend: BODY.restingKnee + BODY.kneeBend * Math.sin(Math.PI * swung),
  };
}

/** An arm that is forward when the leg at `cycle` is forward. */
function walkingArm(cycle: number): Limb {
  const turn = cycle * Math.PI * 2;
  return { swing: BODY.armSwing * Math.cos(turn), bend: BODY.elbowBend * (1 + 0.5 * Math.cos(turn)) };
}

/** Hip, knee and foot of one leg. The knee bends backward. */
function legFrom(hip: Point, { swing, bend }: Limb, facing: 1 | -1): Point[] {
  const knee = stepFrom(hip, { angle: swing, length: BODY.thigh, facing });
  return [hip, knee, stepFrom(knee, { angle: swing - bend, length: BODY.shin, facing })];
}

/** Shoulder, elbow and hand of one arm. The elbow bends forward. */
function armFrom(shoulder: Point, { swing, bend }: Limb, facing: 1 | -1): Point[] {
  const elbow = stepFrom(shoulder, { angle: swing, length: BODY.upperArm, facing });
  return [shoulder, elbow, stepFrom(elbow, { angle: swing + bend, length: BODY.forearm, facing })];
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
