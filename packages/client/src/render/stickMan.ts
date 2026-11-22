import { STICK_MAN_HEIGHT, type Point } from '@stickworld/sim';
import { PENCIL, type Stroke, type StrokePoint } from './strokes';
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
  /** How far along one walk cycle (two steps) he is, from 0 to 1. Ignored when standing. */
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

/** How far he travels in one walk cycle without his planted foot sliding, in metres. */
export function walkCycleLength(): number {
  const plantedAt = (cycle: number): number => legFrom({ x: 0, y: 0 }, { facing: 1, cycle, walking: true })[2]!.x;
  return 2 * (plantedAt(0.25) - plantedAt(0.75));
}

// ---- Helpers ----

/** His proportions, as shares of his height, and how far his limbs swing, in radians. View detail only. */
const BODY = {
  headRadius: 0.1 * STICK_MAN_HEIGHT,
  neckHeight: 0.76 * STICK_MAN_HEIGHT,
  body: 0.31 * STICK_MAN_HEIGHT,
  thigh: 0.235 * STICK_MAN_HEIGHT,
  shin: 0.235 * STICK_MAN_HEIGHT,
  upperArm: 0.15 * STICK_MAN_HEIGHT,
  forearm: 0.15 * STICK_MAN_HEIGHT,
  /** How far below the neck the arms start. */
  shoulderDrop: 0.03 * STICK_MAN_HEIGHT,
  thighSwing: 0.46,
  kneeBend: 0.95,
  restingKnee: 0.06,
  armSwing: 0.5,
  elbowBend: 0.35,
  restingArm: 0.12,
  lean: 0.07,
} as const;

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
    arms: [armFrom(shoulder, { facing, cycle: walkCycle + 0.5, walking }), armFrom(shoulder, { facing, cycle: walkCycle, walking })],
    legs: [legFrom(hip, { facing, cycle: walkCycle, walking }), legFrom(hip, { facing, cycle: walkCycle + 0.5, walking })],
  };
}

/** Hip, knee and foot of one leg. The thigh swings forward and back; the knee bends while the leg comes forward. */
function legFrom(hip: Point, { facing, cycle, walking }: LimbCycle): Point[] {
  const turn = cycle * Math.PI * 2;
  const thigh = walking ? BODY.thighSwing * Math.sin(turn) : 0;
  const bend = BODY.restingKnee + (walking ? BODY.kneeBend * Math.max(0, Math.cos(turn)) : 0);
  const knee = stepFrom(hip, { angle: thigh, length: BODY.thigh, facing });
  return [hip, knee, stepFrom(knee, { angle: thigh - bend, length: BODY.shin, facing })];
}

/** Shoulder, elbow and hand of one arm. The elbow always bends forward. */
function armFrom(shoulder: Point, { facing, cycle, walking }: LimbCycle): Point[] {
  const turn = cycle * Math.PI * 2;
  const upper = walking ? BODY.armSwing * Math.sin(turn) : BODY.restingArm * (cycle % 1 < 0.5 ? 1 : -1);
  const bend = walking ? BODY.elbowBend * (1 + 0.5 * Math.sin(turn)) : BODY.restingArm;
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
