import { STICK_MAN_HEIGHT, type FloorSegment, type Point, type StickManView } from '@stickworld/sim';
import { measureDistanceBetweenLines, type Line } from './geometry';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { PIXELS_PER_METRE, convertToPixels } from './units';

/**
 * The stick man as pencil strokes: a head, a body, two arms and two legs,
 * worked out from code every frame. What he is doing and how far along comes
 * from the sim; which way each limb points is decided here and nowhere else.
 */

export interface StickManPose {
  /** Where his feet are on the floor, in metres. Seated, the middle of the underside of what he sits in. */
  readonly feet: Point;
  /** 1 when he looks right, -1 when he looks left. */
  readonly facing: 1 | -1;
  readonly action: StickManView['action'];
  /** How far along one walk cycle (two steps) he is, from 0 to 1; at 0 a foot has just come down in front of him. Only read when walking. */
  readonly walkCycle: number;
  /** Which way a jump is going: 1 on the way up, 0 at the top, -1 on the way down. Only read while he is in the air at all. */
  readonly rise: number;
  /** Whether he would be walking if his feet were on the floor: what his limbs come from as he takes off and go back to as he lands. */
  readonly striding: boolean;
  /** How far a fall has gone past the end of a jump, from 0 to 1: at 1 he falls with his arms thrown up and out. */
  readonly longFall: number;
  /** How far his limbs have gone from what they do on the floor to what they do in the air, from 0 to 1. */
  readonly inTheAir: number;
  /** How deep he is in the knee bend that takes a landing, from 0 to 1. */
  readonly landing: number;
  /** How far his body tips over as he falls sideways, in radians: positive to the right, 0 upright. Seated, how far what he sits in tips all of him. */
  readonly tilt: number;
  /** How far above `feet` the point is that a seated man tips about, in metres: the middle of what he sits in. Only read when seated. */
  readonly tipsAboutAbove: number;
  /** How far each arm is lifted from where it would point, in radians, so that it rests on a floor line instead of crossing it. */
  readonly armsLifted: readonly [number, number];
  /** How far his arms have gone up to hold something over his head, from 0 to 1. */
  readonly carrying: number;
}

/**
 * The pose that shows the stick man as the sim has him this instant, with nothing eased: all the way in the air the
 * moment he jumps, tipped as far as his fall tips him. It does not know the floor: `keepOffTheFloor` does.
 */
export function getPose(stickMan: StickManView): StickManPose {
  const { feet, facing, action, distanceWalked, verticalSpeed, walkDirectionAsked } = stickMan;
  return {
    feet,
    facing,
    action,
    walkCycle: (distanceWalked / getWalkCycleLength()) % 1,
    rise: Math.max(-1, Math.min(1, -verticalSpeed / BODY.speedOfFullRise)),
    longFall: action === 'jumping' ? Math.max(0, Math.min(1, (verticalSpeed - BODY.speedOfALongFall.from) / (BODY.speedOfALongFall.to - BODY.speedOfALongFall.from))) : 0,
    striding: action === 'walking' || (action === 'jumping' && walkDirectionAsked !== 0),
    inTheAir: action === 'jumping' ? 1 : 0,
    landing: 0,
    tilt: getTiltOfFall(stickMan),
    tipsAboutAbove: 0,
    armsLifted: [0, 0],
    carrying: stickMan.carrying ? 1 : 0,
  };
}

/**
 * `pose` tipped with what he sits in: its nose `noseDown` radians down, turning about a point `tipsAboutAbove` metres
 * above its underside. The pose of a man who is not seated is returned as it is.
 */
export function seatIn(pose: StickManPose, { noseDown, tipsAboutAbove }: { noseDown: number; tipsAboutAbove: number }): StickManPose {
  if (pose.action !== 'seated') return pose;
  return { ...pose, tilt: pose.facing * noseDown, tipsAboutAbove: tipsAboutAbove };
}

/**
 * `pose` with nothing of him drawn across a floor line, for a body in the air. An arm that would cross a line is lifted
 * until it rests on it: as he drops the line pushes the arm further up, and once his shoulder is under the line the arm
 * is free again. `armsLiftedAtLeast` asks for arms no lower than that, for an arm that is on its way down. His body is tipped only as far as keeps his head, body and legs off the line; the sim keeps his head and body clear of it upright.
 */
export function keepOffTheFloor(pose: StickManPose, floor: readonly FloorSegment[], armsLiftedAtLeast: readonly [number, number] = [0, 0]): StickManPose {
  if (pose.action !== 'jumping') return pose;
  const tilt = TILT_SHARES.map((share) => pose.tilt * share).find((tried) => isAllButHisArmsOffTheFloor({ ...pose, tilt: tried }, floor)) ?? 0;
  const tipped = { ...pose, tilt };
  return { ...tipped, armsLifted: [findLeastLiftOffTheFloor(tipped, { arm: 0, floor, atLeast: armsLiftedAtLeast[0] }), findLeastLiftOffTheFloor(tipped, { arm: 1, floor, atLeast: armsLiftedAtLeast[1] })] };
}

/**
 * Returns a function to call every frame with the stick man as the sim has
 * him, the seconds since the last frame and the level's floor. It gives the
 * pose to draw: the sim's, with his limbs taking a moment to get into a jump
 * and out of it, his knees giving as he lands, his body tipping into a fall
 * and his arms catching on the floor line he drops past. The sim jumps, lands
 * and bumps into things in one tick; a body does not. View detail only: where
 * he is never lags.
 */
export function easePosesOverTime(): (stickMan: StickManView, seconds: number, floor: readonly FloorSegment[]) => StickManPose {
  // `tilt` is how far he would be tipped with no line in the way: what is shown may be less, and eases from this all the same.
  let previous: { feet: Point; inTheAir: number; landing: number; falling: boolean; tilt: number; armsLifted: readonly [number, number]; carrying: number } | undefined;
  return (stickMan, seconds, floor) => {
    const pose = getPose(stickMan);
    const jumpedAcrossThePaper = previous !== undefined && Math.hypot(pose.feet.x - previous.feet.x, pose.feet.y - previous.feet.y) > STICK_MAN_HEIGHT;
    if (!previous || jumpedAcrossThePaper) {
      // The first frame, or the level started again: nothing to ease from.
      const shown = keepOffTheFloor({ ...pose, tilt: 0 }, floor);
      previous = { feet: pose.feet, inTheAir: pose.inTheAir, landing: 0, falling: false, tilt: 0, armsLifted: shown.armsLifted, carrying: pose.carrying };
      return shown;
    }
    const share = seconds / (pose.inTheAir === 1 ? EASING.intoTheAir : EASING.ontoTheFloor);
    const inTheAir = pose.inTheAir === 1 ? Math.min(1, previous.inTheAir + share) : Math.max(0, previous.inTheAir - share);
    const justLanded = previous.falling && stickMan.action !== 'jumping';
    const landing = justLanded ? 1 : Math.max(0, previous.landing - seconds / EASING.landing);
    const mostTipping = seconds * EASING.tiltPerSecond;
    const tilt = previous.tilt + Math.max(-mostTipping, Math.min(mostTipping, pose.tilt - previous.tilt));
    // An arm the line has let go of comes down over a moment, and stays on the line for as long as that would take it across.
    const mostComingDown = seconds * EASING.armComesDownPerSecond;
    const armsMove = seconds / EASING.armsUpAndDown;
    const carrying = previous.carrying + Math.max(-armsMove, Math.min(armsMove, pose.carrying - previous.carrying));
    const shown = keepOffTheFloor({ ...pose, inTheAir, landing, tilt, carrying }, floor, [Math.max(0, previous.armsLifted[0] - mostComingDown), Math.max(0, previous.armsLifted[1] - mostComingDown)]);
    previous = { feet: pose.feet, inTheAir, landing, falling: stickMan.action === 'jumping' && stickMan.verticalSpeed > 0, tilt, armsLifted: shown.armsLifted, carrying };
    return shown;
  };
}

/** The strokes that draw the stick man in `pose`, in world pixels. */
export function buildStickManStrokes(pose: StickManPose): Stroke[] {
  const { head, neck, hip, arms, legs } = getSkeleton(pose);
  const lines = [[neck, hip], ...arms, ...legs];
  return [
    { points: buildCircleAround(head, BODY.headRadius).map(convertPointToPixels), thickness: PENCIL.thickness, closed: true },
    ...lines.map((line) => ({ points: line.map(convertPointToPixels), thickness: PENCIL.thickness })),
  ];
}

/**
 * How far he travels in one walk cycle (two steps), in metres: the distance at
 * which his planted foot does not slide. It follows from his proportions, which
 * are view detail, so the sim does not know it: the sim says how far he has
 * walked and `getPose` works the cycle out from that.
 */
export function getWalkCycleLength(): number {
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
  /**
   * The vertical speed, in metres per second, at which a jump looks fully on its way up or down: a little over half the
   * speed a held jump takes off at (8.9 m/s for the 2 m jump), so he is in the pose of the top for the middle of it.
   */
  speedOfFullRise: 4.8,
  /**
   * Limbs in a jump. On the way up he has pushed off and his arms swing up; at the top his knees are tucked
   * and his arms are highest; on the way down his legs reach for the floor and his arms come down. Between
   * two of them, something in between.
   */
  jumpingUp: { legs: [{ swing: 0.3, bend: 0.55 }, { swing: -0.35, bend: 0.45 }], arms: [{ swing: -0.55, bend: 0.3 }, { swing: 0.9, bend: 0.5 }], lean: 0.1 },
  atTheTop: { legs: [{ swing: 0.75, bend: 1.3 }, { swing: 0.15, bend: 0.9 }], arms: [{ swing: -1.2, bend: 0.1 }, { swing: 1.7, bend: 0.35 }], lean: 0.03 },
  comingDown: { legs: [{ swing: 0.22, bend: 0.2 }, { swing: -0.16, bend: 0.2 }], arms: [{ swing: -0.9, bend: 0.1 }, { swing: 1.0, bend: 0.3 }], lean: -0.04 },
  /**
   * A fall that goes on past where a jump would have landed: his arms are thrown up and out and his legs hang apart.
   * He gets into it between these two falling speeds, in metres per second. The lower one is just above the speed a
   * held jump on level floor lands at (8.9 m/s for the 2 m jump), so no such jump ever shows it, and the higher one is
   * his fastest fall (10 m/s), so a long fall gets all the way into it.
   */
  longFall: { legs: [{ swing: 0.3, bend: 0.35 }, { swing: -0.3, bend: 0.3 }], arms: [{ swing: -2.0, bend: -0.15 }, { swing: 2.05, bend: 0.2 }], lean: 0 },
  speedOfALongFall: { from: 9, to: 10 },
  /** Knees bent under him, feet where they were: how a landing is taken. `landingDepth` is how far into it the hardest landing goes. */
  landed: { legs: [{ swing: 0.5, bend: 1.0 }, { swing: 0.5, bend: 1.0 }], arms: [{ swing: -0.35, bend: 0.3 }, { swing: 0.5, bend: 0.5 }], lean: 0.12 },
  landingDepth: 0.55,
  /** How far he tips over, in radians, falling as fast sideways as down would tip him all of it; see `getTiltOfFall`. */
  fallTilt: 0.6,
  /** The falling speed, in metres per second, from which a fall tips him as far as his sideways speed says. Below it he is still tipping over. */
  speedOfFullTilt: 2.5,
  /** How much of his tilt his legs trail behind by, as a share of it. */
  legsTrailTilt: 0.5,
  /**
   * Holding something over his head: each hand is at the height of the top of him, this far to its side, and each
   * elbow out past his head on the way up. His arms reach what he carries, so they are drawn as long as that takes.
   */
  carrying: { handOut: 0.14 * STICK_MAN_HEIGHT, elbowOut: 0.165 * STICK_MAN_HEIGHT, elbowUp: 0.8 * STICK_MAN_HEIGHT },
  /** Both arms up once the level is finished. */
  cheeringArm: { swing: 2.2, bend: 0.3 },
  /**
   * Seated in the airplane: his hips on its fold, a little behind its middle, his knees up in front of him and his
   * feet down on its nose, leaning into the flight with both hands on it in front of him.
   */
  seated: {
    legs: [{ swing: 1.92, bend: 1.25 }, { swing: 1.77, bend: 0.95 }],
    arms: [{ swing: 0.42, bend: 0.05 }, { swing: 0.56, bend: 0.08 }],
    lean: 0.3,
    hipsAbove: 0.13 * STICK_MAN_HEIGHT,
    hipsBehind: 0.055 * STICK_MAN_HEIGHT,
  },
} as const;

/** How long his limbs take to get from one thing to the next, in seconds. View detail only. */
const EASING = {
  /** From the floor into the jump. */
  intoTheAir: 0.14,
  /** From the jump back to standing or walking. */
  ontoTheFloor: 0.12,
  /** How long the knee bend of a landing lasts. */
  landing: 0.26,
  /** How fast his body tips into a fall and back upright, in radians per second. */
  tiltPerSecond: 3,
  /** How fast an arm comes back down once the floor line has let go of it, in radians per second. */
  armComesDownPerSecond: 7,
  /** How long his arms take to go up to hold something over his head, and to come down again. */
  armsUpAndDown: 0.16,
} as const;

/** How close to a floor line his arms, body and head may be drawn, in metres: the two pencil lines touch and do not cross. */
const OFF_THE_LINE = PENCIL.thickness / PIXELS_PER_METRE;

/** How far an arm is lifted at a time when looking for where it rests on a line, in radians. */
const LIFT_STEP = 0.03;

/** The shares of his tilt tried, in order, until his head and body are off every floor line. */
const TILT_SHARES = [1, 0.75, 0.5, 0.25, 0];

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
function getSkeleton(pose: StickManPose): Skeleton {
  if (pose.action === 'seated') return getSeatedSkeleton(pose);
  const { feet, facing, tilt } = pose;
  const posed = getLimbs(pose);
  // Tipping over, his legs trail behind his body, and each arm is as far up as the floor line has pushed it.
  const limbs = {
    ...posed,
    legs: posed.legs.map((leg) => ({ ...leg, swing: leg.swing - tilt * facing * BODY.legsTrailTilt })),
    arms: posed.arms.map((arm, index) => ({ ...arm, swing: arm.swing + (arm.swing < 0 ? -1 : 1) * pose.armsLifted[index]! })),
  };
  const origin = { x: 0, y: 0 };
  const reach = Math.max(...limbs.legs.map((leg) => buildLegFrom(origin, leg, facing)[2]!.y));
  const hip = { x: feet.x, y: feet.y - reach };
  const lean = limbs.lean * facing + tilt;
  const neck = { x: hip.x + Math.sin(lean) * BODY.body, y: hip.y - Math.cos(lean) * BODY.body };
  const head = { x: neck.x + Math.sin(lean) * BODY.headRadius, y: neck.y - Math.cos(lean) * BODY.headRadius };
  const shoulder = { x: neck.x - Math.sin(lean) * BODY.shoulderDrop, y: neck.y + Math.cos(lean) * BODY.shoulderDrop };
  // What he carries takes his arms, whatever the rest of him does: each goes from where it would be to holding it up.
  const holdingUp = smooth(pose.carrying);
  const arms = limbs.arms.map((arm, index) => {
    const side = (index === 0 ? -1 : 1) * facing;
    const held = [shoulder, { x: feet.x + side * BODY.carrying.elbowOut, y: feet.y - BODY.carrying.elbowUp }, { x: feet.x + side * BODY.carrying.handOut, y: feet.y - STICK_MAN_HEIGHT }];
    return buildArmFrom(shoulder, arm, facing).map((joint, jointIndex) => movePartWay(joint, held[jointIndex]!, holdingUp));
  });
  return { head, neck, hip, arms, legs: limbs.legs.map((leg) => buildLegFrom(hip, leg, facing)) };
}

/** Every joint of a seated man, in metres: sat where the sim has him, then tipped with what he sits in. */
function getSeatedSkeleton({ feet, facing, tilt, tipsAboutAbove }: StickManPose): Skeleton {
  const { legs, arms, lean, hipsAbove, hipsBehind } = BODY.seated;
  const hip = { x: feet.x - facing * hipsBehind, y: feet.y - hipsAbove };
  const neck = { x: hip.x + Math.sin(lean * facing) * BODY.body, y: hip.y - Math.cos(lean) * BODY.body };
  const head = { x: neck.x + Math.sin(lean * facing) * BODY.headRadius, y: neck.y - Math.cos(lean) * BODY.headRadius };
  const shoulder = { x: neck.x - Math.sin(lean * facing) * BODY.shoulderDrop, y: neck.y + Math.cos(lean) * BODY.shoulderDrop };
  const about = { x: feet.x, y: feet.y - tipsAboutAbove };
  const tip = (point: Point): Point => turnAbout(about, point, tilt);
  return {
    head: tip(head),
    neck: tip(neck),
    hip: tip(hip),
    arms: arms.map((arm) => buildArmFrom(shoulder, arm, facing).map(tip)),
    legs: legs.map((leg) => buildLegFrom(hip, leg, facing).map(tip)),
  };
}

/** `point` turned about `centre` by `angle` radians, clockwise on the page. */
function turnAbout(centre: Point, point: Point, angle: number): Point {
  const x = point.x - centre.x;
  const y = point.y - centre.y;
  return { x: centre.x + x * Math.cos(angle) - y * Math.sin(angle), y: centre.y + x * Math.sin(angle) + y * Math.cos(angle) };
}

/** The point `share` of the way from `from` to `to`. */
function movePartWay(from: Point, to: Point, share: number): Point {
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
}

/**
 * How far a fall tips him over, in radians, positive to the right: in proportion to how fast he moves sideways against
 * how fast he falls. Dropping straight he stays upright; walking off an edge he tips forward as the fall takes hold,
 * and straightens as falling outweighs drifting. Only a fall off an edge tips him: a jump has its own poses, forward or back.
 */
function getTiltOfFall({ fallingOffAnEdge, horizontalSpeed, verticalSpeed }: StickManView): number {
  if (!fallingOffAnEdge || verticalSpeed <= 0) return 0;
  const sidewaysShare = horizontalSpeed / Math.hypot(horizontalSpeed, verticalSpeed);
  return BODY.fallTilt * sidewaysShare * Math.min(1, verticalSpeed / BODY.speedOfFullTilt);
}

function isAllButHisArmsOffTheFloor(pose: StickManPose, floor: readonly FloorSegment[]): boolean {
  const { head, neck, hip, legs } = getSkeleton(pose);
  const bodyAndLegs: Line[] = [[neck, hip], ...legs.flatMap(([top, knee, foot]): Line[] => [[top!, knee!], [knee!, foot!]])];
  return floor.every(({ from, to }) => measureDistanceBetweenLines([head, head], [from, to]) >= BODY.headRadius + OFF_THE_LINE && bodyAndLegs.every((line) => measureDistanceBetweenLines(line, [from, to]) >= OFF_THE_LINE));
}

function isArmOffTheFloor(pose: StickManPose, { arm, floor }: { arm: 0 | 1; floor: readonly FloorSegment[] }): boolean {
  const [shoulder, elbow, hand] = getSkeleton(pose).arms[arm]!;
  return floor.every(({ from, to }) => measureDistanceBetweenLines([shoulder!, elbow!], [from, to]) >= OFF_THE_LINE && measureDistanceBetweenLines([elbow!, hand!], [from, to]) >= OFF_THE_LINE);
}

/** The least an arm has to be lifted from where it would point, and no less than `atLeast`, to be off every floor line: `atLeast` for an arm that crosses none there. */
function findLeastLiftOffTheFloor(pose: StickManPose, { arm, floor, atLeast }: { arm: 0 | 1; floor: readonly FloorSegment[]; atLeast: number }): number {
  const liftBy = (lift: number): StickManPose => ({ ...pose, armsLifted: arm === 0 ? [lift, pose.armsLifted[1]] : [pose.armsLifted[0], lift] });
  // Straight up is as far as an arm lifts.
  const straightUp = Math.PI - Math.abs(getLimbs(pose).arms[arm].swing);
  for (let lift = atLeast; lift <= straightUp; lift += LIFT_STEP) {
    if (isArmOffTheFloor(liftBy(lift), { arm, floor })) return lift;
  }
  // No way up is clear, which no level's floor does to him: leave the arm as low as it was asked to be.
  return atLeast;
}

/** Where every limb points for what he is doing: what he does on the floor, as far into a jump as he is, as deep in a landing as he is. */
function getLimbs(pose: StickManPose): Limbs {
  const { rise, longFall, inTheAir, landing } = pose;
  const inAJump = rise >= 0 ? blendBetween(BODY.atTheTop, BODY.jumpingUp, rise) : blendBetween(BODY.atTheTop, BODY.comingDown, -rise);
  const jumping = blendBetween(inAJump, BODY.longFall, smooth(longFall));
  const offTheFloor = blendBetween(getLimbsOnTheFloor(pose), jumping, smooth(inTheAir));
  // A landing is deepest the moment he touches down and eases out: fast at first, slow at the end.
  return blendBetween(offTheFloor, BODY.landed, BODY.landingDepth * landing * landing);
}

/** Where every limb points with his feet on the floor. */
function getLimbsOnTheFloor({ action, striding, walkCycle }: StickManPose): Limbs {
  const standingLeg = { swing: 0, bend: BODY.restingKnee };
  if (striding) {
    // Each arm swings with the opposite leg.
    return { legs: [getWalkingLeg(walkCycle), getWalkingLeg(walkCycle + 0.5)], arms: [getWalkingArm(walkCycle + 0.5), getWalkingArm(walkCycle)], lean: BODY.lean };
  }
  if (action === 'cheering') {
    const { swing, bend } = BODY.cheeringArm;
    return { legs: [standingLeg, standingLeg], arms: [{ swing: -swing, bend: -bend }, { swing, bend }], lean: 0 };
  }
  // Standing, his arms hang a little apart: one behind him, one in front.
  return { legs: [standingLeg, standingLeg], arms: [{ swing: -BODY.restingArm, bend: BODY.restingArm }, { swing: BODY.restingArm, bend: BODY.restingArm }], lean: 0 };
}

/** The limbs `share` of the way from `from` to `to`: 0 is `from`, 1 is `to`. */
function blendBetween(from: Limbs, to: Limbs, share: number): Limbs {
  const mix = (start: number, end: number): number => start + (end - start) * share;
  const mixLimb = (start: Limb, end: Limb): Limb => ({ swing: mix(start.swing, end.swing), bend: mix(start.bend, end.bend) });
  return {
    legs: [mixLimb(from.legs[0], to.legs[0]), mixLimb(from.legs[1], to.legs[1])],
    arms: [mixLimb(from.arms[0], to.arms[0]), mixLimb(from.arms[1], to.arms[1])],
    lean: mix(from.lean, to.lean),
  };
}

/** `share` from 0 to 1, starting and ending gently (smoothstep). */
function smooth(share: number): number {
  return share * share * (3 - 2 * share);
}

/**
 * A leg at `cycle` of the walk. For the first half of its cycle the foot is
 * planted: it goes back under him at the speed he goes forward, on a straight
 * leg. For the second half the leg swings forward again with the knee bent.
 */
function getWalkingLeg(cycle: number): Limb {
  const within = ((cycle % 1) + 1) % 1;
  if (within < 0.5) return { swing: Math.asin((STEP_REACH * (1 - 4 * within)) / (BODY.thigh + BODY.shin)), bend: BODY.restingKnee };
  const swung = (within - 0.5) * 2;
  return {
    swing: -BODY.thighSwing * Math.cos(Math.PI * swung) + BODY.kneeLift * Math.sin(Math.PI * swung),
    bend: BODY.restingKnee + BODY.kneeBend * Math.sin(Math.PI * swung),
  };
}

/** An arm that is forward when the leg at `cycle` is forward. */
function getWalkingArm(cycle: number): Limb {
  const turn = cycle * Math.PI * 2;
  return { swing: BODY.armSwing * Math.cos(turn), bend: BODY.elbowBend * (1 + 0.5 * Math.cos(turn)) };
}

/** Hip, knee and foot of one leg. The knee bends backward. */
function buildLegFrom(hip: Point, { swing, bend }: Limb, facing: 1 | -1): Point[] {
  const knee = stepFrom(hip, { angle: swing, length: BODY.thigh, facing });
  return [hip, knee, stepFrom(knee, { angle: swing - bend, length: BODY.shin, facing })];
}

/** Shoulder, elbow and hand of one arm. The elbow bends forward. */
function buildArmFrom(shoulder: Point, { swing, bend }: Limb, facing: 1 | -1): Point[] {
  const elbow = stepFrom(shoulder, { angle: swing, length: BODY.upperArm, facing });
  return [shoulder, elbow, stepFrom(elbow, { angle: swing + bend, length: BODY.forearm, facing })];
}

/** The point `length` away from `from`, at `angle` from straight down, forward being the way he faces. */
function stepFrom(from: Point, { angle, length, facing }: { angle: number; length: number; facing: 1 | -1 }): Point {
  return { x: from.x + Math.sin(angle) * length * facing, y: from.y + Math.cos(angle) * length };
}

const HEAD_CORNERS = 18;

function buildCircleAround(centre: Point, radius: number): Point[] {
  return Array.from({ length: HEAD_CORNERS }, (_, corner) => {
    // Start at the top, where a hand starts a circle.
    const angle = (corner / HEAD_CORNERS) * Math.PI * 2 - Math.PI / 2;
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
  });
}

const convertPointToPixels = (point: Point): StrokePoint => ({ x: convertToPixels(point.x), y: convertToPixels(point.y) });

export const __testing__ = { getSkeleton, BODY, EASING, OFF_THE_LINE };
