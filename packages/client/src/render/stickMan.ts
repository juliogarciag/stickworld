import {
  STICK_MAN_HEIGHT,
  type FloorSegment,
  type Point,
  type StickManView,
} from '@stickworld/sim';
import { measureDistanceBetweenLines, type Line } from './geometry';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { PIXELS_PER_METRE, convertToPixels } from './units';

/**
 * The stick man as pencil strokes: a head, a body, two arms and two legs,
 * worked out from code every frame. What the stick man is doing and how far along comes
 * from the sim; which way each limb points is decided here and nowhere else.
 */

export interface StickManPose {
  /** Where the stick man's feet are on the floor, in metres. Seated, the middle of the underside of what the stick man sits in. */
  readonly feet: Point;
  /** 1 when the stick man looks right, -1 when it looks left. */
  readonly facing: 1 | -1;
  readonly action: StickManView['action'];
  /** How far along one walk cycle (two steps) the stick man is, from 0 to 1; at 0 a foot has just come down in front of the stick man. Only read when walking. */
  readonly walkCycle: number;
  /** Which way a jump is going: 1 on the way up, 0 at the top, -1 on the way down. Only read while the stick man is in the air at all. */
  readonly rise: number;
  /** Whether the stick man would be walking if its feet were on the floor: what the stick man's limbs come from as it takes off and go back to as it lands. */
  readonly isStriding: boolean;
  /** How far a fall has gone past the end of a jump, from 0 to 1: at 1 the stick man falls with its arms thrown up and out. */
  readonly longFall: number;
  /** How far the stick man's limbs have gone from what they do on the floor to what they do in the air, from 0 to 1. */
  readonly airborneShare: number;
  /** How deep the stick man is in the knee bend that takes a landing, from 0 to 1. */
  readonly landing: number;
  /** How far the stick man's body tips over as it falls sideways, in radians: positive to the right, 0 upright. Seated, how far what the stick man sits in tips all of it. */
  readonly tilt: number;
  /** How far above `feet` the point is that a seated man tips about, in metres: the middle of what the stick man sits in. Only read when seated. */
  readonly tipsAboutAbove: number;
  /** How far each arm is lifted from where it would point, in radians, so that it rests on a floor line instead of crossing it. */
  readonly armsLifted: readonly [number, number];
  /** How far the stick man's arms have gone up to hold something over its head, from 0 to 1. */
  readonly carrying: number;
}

/**
 * The pose that shows the stick man as the sim has it this instant, with nothing eased: all the way in the air the
 * moment the stick man jumps, tipped as far as its fall tips it. It does not know the floor: `keepOffFloor` does.
 */
export function getPose(stickMan: StickManView): StickManPose {
  const { feet, facing, action, distanceWalked, verticalSpeed, walkDirectionAsked } = stickMan;
  return {
    feet,
    facing,
    action,
    walkCycle: (distanceWalked / getWalkCycleLength()) % 1,
    rise: Math.max(-1, Math.min(1, -verticalSpeed / BODY.speedOfFullRise)),
    longFall:
      action === 'jumping'
        ? Math.max(
            0,
            Math.min(
              1,
              (verticalSpeed - BODY.longFallSpeed.start) /
                (BODY.longFallSpeed.end - BODY.longFallSpeed.start),
            ),
          )
        : 0,
    isStriding: action === 'walking' || (action === 'jumping' && walkDirectionAsked !== 0),
    airborneShare: action === 'jumping' ? 1 : 0,
    landing: 0,
    tilt: getTiltOfFall(stickMan),
    tipsAboutAbove: 0,
    armsLifted: [0, 0],
    carrying: stickMan.isCarrying ? 1 : 0,
  };
}

/**
 * `pose` tipped with what the stick man sits in: its nose `noseDown` radians down, turning about a point `tipsAboutAbove` metres
 * above its underside. The pose of a man who is not seated is returned as it is.
 */
export function seatIn(
  pose: StickManPose,
  seat: { noseDown: number; tipsAboutAbove: number },
): StickManPose {
  if (pose.action !== 'seated') {
    return pose;
  }
  return { ...pose, tilt: pose.facing * seat.noseDown, tipsAboutAbove: seat.tipsAboutAbove };
}

/**
 * `pose` with nothing of the stick man drawn across a floor line, for a body in the air. An arm that would cross a line is lifted
 * until it rests on it: as the stick man drops the line pushes the arm further up, and once its shoulder is under the line the arm
 * is free again. `armsLiftedAtLeast` asks for arms no lower than that, for an arm that is on its way down. The stick man's body is tipped only as far as keeps its head, body and legs off the line; the sim keeps the stick man's head and body clear of it upright.
 */
export function keepOffFloor(
  pose: StickManPose,
  floor: readonly FloorSegment[],
  armsLiftedAtLeast: readonly [number, number] = [0, 0],
): StickManPose {
  if (pose.action !== 'jumping') {
    return pose;
  }
  const tilt =
    TILT_SHARES.map((share) => pose.tilt * share).find((tried) =>
      isBodyOffFloor({ ...pose, tilt: tried }, floor),
    ) ?? 0;
  const tipped = { ...pose, tilt };
  return {
    ...tipped,
    armsLifted: [
      findMinArmLift(tipped, { arm: 0, floor, atLeast: armsLiftedAtLeast[0] }),
      findMinArmLift(tipped, { arm: 1, floor, atLeast: armsLiftedAtLeast[1] }),
    ],
  };
}

/**
 * Returns a function to call every frame with the stick man as the sim has
 * it, the seconds since the last frame and the level's floor. It gives the
 * pose to draw: the sim's, with the stick man's limbs taking a moment to get into a jump
 * and out of it, the stick man's knees giving as the stick man lands, the stick man's body tipping into a fall
 * and the stick man's arms catching on the floor line the stick man drops past. The sim jumps, lands
 * and bumps into things in one tick; a body does not. View detail only: where
 * the stick man is never lags.
 */
export function easePosesOverTime(): (
  stickMan: StickManView,
  seconds: number,
  floor: readonly FloorSegment[],
) => StickManPose {
  // `tilt` is how far the stick man would be tipped with no line in the way: what is shown may be less, and eases from this all the same.
  let previous:
    | {
        feet: Point;
        airborneShare: number;
        landing: number;
        isFalling: boolean;
        tilt: number;
        armsLifted: readonly [number, number];
        carrying: number;
      }
    | undefined;
  return (stickMan, seconds, floor) => {
    const pose = getPose(stickMan);
    const hasJumpedAcrossPaper =
      previous !== undefined &&
      Math.hypot(pose.feet.x - previous.feet.x, pose.feet.y - previous.feet.y) > STICK_MAN_HEIGHT;
    if (!previous || hasJumpedAcrossPaper) {
      // The first frame, or the level started again: nothing to ease from.
      const shown = keepOffFloor({ ...pose, tilt: 0 }, floor);
      previous = {
        feet: pose.feet,
        airborneShare: pose.airborneShare,
        landing: 0,
        isFalling: false,
        tilt: 0,
        armsLifted: shown.armsLifted,
        carrying: pose.carrying,
      };
      return shown;
    }
    const share =
      seconds / (pose.airborneShare === 1 ? EASING.takeoffSeconds : EASING.landingSeconds);
    const airborneShare =
      pose.airborneShare === 1
        ? Math.min(1, previous.airborneShare + share)
        : Math.max(0, previous.airborneShare - share);
    const hasJustLanded = previous.isFalling && stickMan.action !== 'jumping';
    const landing = hasJustLanded ? 1 : Math.max(0, previous.landing - seconds / EASING.landing);
    const mostTipping = seconds * EASING.tiltPerSecond;
    const tilt =
      previous.tilt + Math.max(-mostTipping, Math.min(mostTipping, pose.tilt - previous.tilt));
    // An arm the line has let go of comes down over a moment, and stays on the line for as long as that would take it across.
    const mostComingDown = seconds * EASING.armComesDownPerSecond;
    const armsMove = seconds / EASING.armsUpAndDown;
    const carrying =
      previous.carrying +
      Math.max(-armsMove, Math.min(armsMove, pose.carrying - previous.carrying));
    const shown = keepOffFloor({ ...pose, airborneShare, landing, tilt, carrying }, floor, [
      Math.max(0, previous.armsLifted[0] - mostComingDown),
      Math.max(0, previous.armsLifted[1] - mostComingDown),
    ]);
    previous = {
      feet: pose.feet,
      airborneShare,
      landing,
      isFalling: stickMan.action === 'jumping' && stickMan.verticalSpeed > 0,
      tilt,
      armsLifted: shown.armsLifted,
      carrying,
    };
    return shown;
  };
}

/** The strokes that draw the stick man in `pose`, in world pixels. */
export function buildStickManStrokes(pose: StickManPose): Stroke[] {
  const { head, neck, hip, arms, legs } = getSkeleton(pose);
  const lines = [[neck, hip], ...arms, ...legs];
  return [
    {
      points: buildCircleAround(head, BODY.headRadius).map(convertPointToPixels),
      thickness: PENCIL.thickness,
      isClosed: true,
    },
    ...lines.map((line) => ({
      points: line.map(convertPointToPixels),
      thickness: PENCIL.thickness,
    })),
  ];
}

/**
 * How far the stick man travels in one walk cycle (two steps), in metres: the distance at
 * which the stick man's planted foot does not slide. It follows from the stick man's proportions, which
 * are view detail, so the sim does not know it: the sim says how far the stick man has
 * walked and `getPose` works the cycle out from that.
 */
export function getWalkCycleLength(): number {
  return 4 * STEP_REACH;
}

// ---- Helpers ----

/** The stick man's proportions, as shares of its height, and how far its limbs swing, in radians. View detail only. */
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
   * speed a held jump takes off at (8.9 m/s for the 2 m jump), so the stick man is in the pose of the top for the middle of it.
   */
  speedOfFullRise: 4.8,
  /**
   * Limbs in a jump. On the way up the stick man has pushed off and its arms swing up; at the top the stick man's knees are tucked
   * and its arms are highest; on the way down the stick man's legs reach for the floor and its arms come down. Between
   * two of them, something in between.
   */
  jumpingUp: {
    legs: [
      { swing: 0.3, bend: 0.55 },
      { swing: -0.35, bend: 0.45 },
    ],
    arms: [
      { swing: -0.55, bend: 0.3 },
      { swing: 0.9, bend: 0.5 },
    ],
    lean: 0.1,
  },
  apex: {
    legs: [
      { swing: 0.75, bend: 1.3 },
      { swing: 0.15, bend: 0.9 },
    ],
    arms: [
      { swing: -1.2, bend: 0.1 },
      { swing: 1.7, bend: 0.35 },
    ],
    lean: 0.03,
  },
  comingDown: {
    legs: [
      { swing: 0.22, bend: 0.2 },
      { swing: -0.16, bend: 0.2 },
    ],
    arms: [
      { swing: -0.9, bend: 0.1 },
      { swing: 1.0, bend: 0.3 },
    ],
    lean: -0.04,
  },
  /**
   * A fall that goes on past where a jump would have landed: the stick man's arms are thrown up and out and its legs hang apart.
   * The stick man gets into it between these two falling speeds, in metres per second. The lower one is just above the speed a
   * held jump on level floor lands at (8.9 m/s for the 2 m jump), so no such jump ever shows it, and the higher one is
   * the stick man's fastest fall (10 m/s), so a long fall gets all the way into it.
   */
  longFall: {
    legs: [
      { swing: 0.3, bend: 0.35 },
      { swing: -0.3, bend: 0.3 },
    ],
    arms: [
      { swing: -2.0, bend: -0.15 },
      { swing: 2.05, bend: 0.2 },
    ],
    lean: 0,
  },
  longFallSpeed: { start: 9, end: 10 },
  /** Knees bent under the stick man, feet where they were: how a landing is taken. `landingDepth` is how far into it the hardest landing goes. */
  landed: {
    legs: [
      { swing: 0.5, bend: 1.0 },
      { swing: 0.5, bend: 1.0 },
    ],
    arms: [
      { swing: -0.35, bend: 0.3 },
      { swing: 0.5, bend: 0.5 },
    ],
    lean: 0.12,
  },
  landingDepth: 0.55,
  /** How far the stick man tips over, in radians, falling as fast sideways as down would tip the stick man all of it; see `getTiltOfFall`. */
  fallTilt: 0.6,
  /** The falling speed, in metres per second, from which a fall tips the stick man as far as its sideways speed says. Below it the stick man is still tipping over. */
  speedOfFullTilt: 2.5,
  /** How much of the stick man's tilt the stick man's legs trail behind by, as a share of it. */
  legsTrailTilt: 0.5,
  /**
   * Holding something over the stick man's head: each hand is at the height of the top of the stick man, this far to its side, and each
   * elbow out past the stick man's head on the way up. The stick man's arms reach what it carries, so they are drawn as long as that takes.
   */
  carrying: {
    handOut: 0.14 * STICK_MAN_HEIGHT,
    elbowOut: 0.165 * STICK_MAN_HEIGHT,
    elbowUp: 0.8 * STICK_MAN_HEIGHT,
  },
  /** Both arms up once the level is finished. */
  cheeringArm: { swing: 2.2, bend: 0.3 },
  /**
   * Seated in the airplane: the stick man's hips on its fold, a little behind its middle, the stick man's knees up in front of the stick man and the stick man's
   * feet down on its nose, leaning into the flight with both hands on it in front of the stick man.
   */
  seated: {
    legs: [
      { swing: 1.92, bend: 1.25 },
      { swing: 1.77, bend: 0.95 },
    ],
    arms: [
      { swing: 0.42, bend: 0.05 },
      { swing: 0.56, bend: 0.08 },
    ],
    lean: 0.3,
    hipsAbove: 0.13 * STICK_MAN_HEIGHT,
    hipsBehind: 0.055 * STICK_MAN_HEIGHT,
  },
} as const;

/** How long the stick man's limbs take to get from one thing to the next, in seconds. View detail only. */
const EASING = {
  /** From the floor into the jump. */
  takeoffSeconds: 0.14,
  /** From the jump back to standing or walking. */
  landingSeconds: 0.12,
  /** How long the knee bend of a landing lasts. */
  landing: 0.26,
  /** How fast the stick man's body tips into a fall and back upright, in radians per second. */
  tiltPerSecond: 3,
  /** How fast an arm comes back down once the floor line has let go of it, in radians per second. */
  armComesDownPerSecond: 7,
  /** How long the stick man's arms take to go up to hold something over its head, and to come down again. */
  armsUpAndDown: 0.16,
} as const;

/** How close to a floor line the stick man's arms, body and head may be drawn, in metres: the two pencil lines touch and do not cross. */
const LINE_CLEARANCE = PENCIL.thickness / PIXELS_PER_METRE;

/** How far an arm is lifted at a time when looking for where it rests on a line, in radians. */
const LIFT_STEP = 0.03;

/** The shares of the stick man's tilt tried, in order, until its head and body are off every floor line. */
const TILT_SHARES = [1, 0.75, 0.5, 0.25, 0];

/** How far in front of the stick man's hips a foot comes down, and how far behind it lifts off, in metres. */
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
  /** How far the stick man's body tips forward. */
  readonly lean: number;
}

/** Every joint, in metres. The lower foot is where the sim says the stick man's feet are, so the hips rise and fall as it walks. */
function getSkeleton(pose: StickManPose): Skeleton {
  if (pose.action === 'seated') {
    return getSeatedSkeleton(pose);
  }
  const { feet, facing, tilt } = pose;
  const posed = getLimbs(pose);
  // Tipping over, the stick man's legs trail behind the stick man's body, and each arm is as far up as the floor line has pushed it.
  const limbs = {
    ...posed,
    legs: posed.legs.map((leg) => ({
      ...leg,
      swing: leg.swing - tilt * facing * BODY.legsTrailTilt,
    })),
    arms: posed.arms.map((arm, index) => ({
      ...arm,
      swing: arm.swing + (arm.swing < 0 ? -1 : 1) * pose.armsLifted[index]!,
    })),
  };
  const origin = { x: 0, y: 0 };
  const reach = Math.max(...limbs.legs.map((leg) => buildLegFrom(origin, leg, facing)[2]!.y));
  const hip = { x: feet.x, y: feet.y - reach };
  const lean = limbs.lean * facing + tilt;
  const neck = { x: hip.x + Math.sin(lean) * BODY.body, y: hip.y - Math.cos(lean) * BODY.body };
  const head = {
    x: neck.x + Math.sin(lean) * BODY.headRadius,
    y: neck.y - Math.cos(lean) * BODY.headRadius,
  };
  const shoulder = {
    x: neck.x - Math.sin(lean) * BODY.shoulderDrop,
    y: neck.y + Math.cos(lean) * BODY.shoulderDrop,
  };
  // What the stick man carries takes the stick man's arms, whatever the rest of the stick man does: each goes from where it would be to holding it up.
  const holdingUp = smooth(pose.carrying);
  const arms = limbs.arms.map((arm, index) => {
    const side = (index === 0 ? -1 : 1) * facing;
    const held = [
      shoulder,
      { x: feet.x + side * BODY.carrying.elbowOut, y: feet.y - BODY.carrying.elbowUp },
      { x: feet.x + side * BODY.carrying.handOut, y: feet.y - STICK_MAN_HEIGHT },
    ];
    return buildArmFrom(shoulder, arm, facing).map((joint, jointIndex) =>
      movePartWay(joint, held[jointIndex]!, holdingUp),
    );
  });
  return { head, neck, hip, arms, legs: limbs.legs.map((leg) => buildLegFrom(hip, leg, facing)) };
}

/** Every joint of a seated man, in metres: sat where the sim has the stick man, then tipped with what it sits in. */
function getSeatedSkeleton(pose: StickManPose): Skeleton {
  const { legs, arms, lean, hipsAbove, hipsBehind } = BODY.seated;
  const hip = { x: pose.feet.x - pose.facing * hipsBehind, y: pose.feet.y - hipsAbove };
  const neck = {
    x: hip.x + Math.sin(lean * pose.facing) * BODY.body,
    y: hip.y - Math.cos(lean) * BODY.body,
  };
  const head = {
    x: neck.x + Math.sin(lean * pose.facing) * BODY.headRadius,
    y: neck.y - Math.cos(lean) * BODY.headRadius,
  };
  const shoulder = {
    x: neck.x - Math.sin(lean * pose.facing) * BODY.shoulderDrop,
    y: neck.y + Math.cos(lean) * BODY.shoulderDrop,
  };
  const pivot = { x: pose.feet.x, y: pose.feet.y - pose.tipsAboutAbove };
  const tip = (point: Point): Point => turnAbout(pivot, point, pose.tilt);
  return {
    head: tip(head),
    neck: tip(neck),
    hip: tip(hip),
    arms: arms.map((arm) => buildArmFrom(shoulder, arm, pose.facing).map(tip)),
    legs: legs.map((leg) => buildLegFrom(hip, leg, pose.facing).map(tip)),
  };
}

/** `point` turned about `centre` by `angle` radians, clockwise on the page. */
function turnAbout(centre: Point, point: Point, angle: number): Point {
  const x = point.x - centre.x;
  const y = point.y - centre.y;
  return {
    x: centre.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: centre.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

/** The point `share` of the way from `from` to `to`. */
function movePartWay(start: Point, end: Point, share: number): Point {
  return { x: start.x + (end.x - start.x) * share, y: start.y + (end.y - start.y) * share };
}

/**
 * How far a fall tips the stick man over, in radians, positive to the right: in proportion to how fast the stick man moves sideways against
 * how fast it falls. Dropping straight the stick man stays upright; walking off an edge the stick man tips forward as the fall takes hold,
 * and straightens as falling outweighs drifting. Only a fall off an edge tips the stick man: a jump has its own poses, forward or back.
 */
function getTiltOfFall(stickMan: StickManView): number {
  if (!stickMan.isFallingOffEdge || stickMan.verticalSpeed <= 0) {
    return 0;
  }
  const sidewaysShare =
    stickMan.horizontalSpeed / Math.hypot(stickMan.horizontalSpeed, stickMan.verticalSpeed);
  return BODY.fallTilt * sidewaysShare * Math.min(1, stickMan.verticalSpeed / BODY.speedOfFullTilt);
}

function isBodyOffFloor(pose: StickManPose, floor: readonly FloorSegment[]): boolean {
  const { head, neck, hip, legs } = getSkeleton(pose);
  const bodyAndLegs: Line[] = [
    [neck, hip],
    ...legs.flatMap(([top, knee, foot]): Line[] => [
      [top!, knee!],
      [knee!, foot!],
    ]),
  ];
  return floor.every(
    (segment) =>
      measureDistanceBetweenLines([head, head], [segment.start, segment.end]) >=
        BODY.headRadius + LINE_CLEARANCE &&
      bodyAndLegs.every(
        (line) => measureDistanceBetweenLines(line, [segment.start, segment.end]) >= LINE_CLEARANCE,
      ),
  );
}

function isArmOffFloor(
  pose: StickManPose,
  input: { arm: 0 | 1; floor: readonly FloorSegment[] },
): boolean {
  const [shoulder, elbow, hand] = getSkeleton(pose).arms[input.arm]!;
  return input.floor.every(
    (segment) =>
      measureDistanceBetweenLines([shoulder!, elbow!], [segment.start, segment.end]) >=
        LINE_CLEARANCE &&
      measureDistanceBetweenLines([elbow!, hand!], [segment.start, segment.end]) >= LINE_CLEARANCE,
  );
}

/** The least an arm has to be lifted from where it would point, and no less than `atLeast`, to be off every floor line: `atLeast` for an arm that crosses none there. */
function findMinArmLift(
  pose: StickManPose,
  input: { arm: 0 | 1; floor: readonly FloorSegment[]; atLeast: number },
): number {
  const liftBy = (lift: number): StickManPose => ({
    ...pose,
    armsLifted: input.arm === 0 ? [lift, pose.armsLifted[1]] : [pose.armsLifted[0], lift],
  });
  // Straight up is as far as an arm lifts.
  const straightUp = Math.PI - Math.abs(getLimbs(pose).arms[input.arm].swing);
  for (let lift = input.atLeast; lift <= straightUp; lift += LIFT_STEP) {
    if (isArmOffFloor(liftBy(lift), { arm: input.arm, floor: input.floor })) {
      return lift;
    }
  }
  // No way up is clear, which no level's floor does to the stick man: leave the arm as low as it was asked to be.
  return input.atLeast;
}

/** Where every limb points for what the stick man is doing: what the stick man does on the floor, as far into a jump as it is, as deep in a landing as it is. */
function getLimbs(pose: StickManPose): Limbs {
  const { rise, longFall, airborneShare, landing } = pose;
  const midJumpLimbs =
    rise >= 0
      ? blendBetween(BODY.apex, BODY.jumpingUp, rise)
      : blendBetween(BODY.apex, BODY.comingDown, -rise);
  const jumping = blendBetween(midJumpLimbs, BODY.longFall, smooth(longFall));
  const airborneLimbs = blendBetween(getLimbsOnFloor(pose), jumping, smooth(airborneShare));
  // A landing is deepest the moment the stick man touches down and eases out: fast at first, slow at the end.
  return blendBetween(airborneLimbs, BODY.landed, BODY.landingDepth * landing * landing);
}

/** Where every limb points with the stick man's feet on the floor. */
function getLimbsOnFloor(pose: StickManPose): Limbs {
  const standingLeg = { swing: 0, bend: BODY.restingKnee };
  if (pose.isStriding) {
    // Each arm swings with the opposite leg.
    return {
      legs: [getWalkingLeg(pose.walkCycle), getWalkingLeg(pose.walkCycle + 0.5)],
      arms: [getWalkingArm(pose.walkCycle + 0.5), getWalkingArm(pose.walkCycle)],
      lean: BODY.lean,
    };
  }
  if (pose.action === 'cheering') {
    const { swing, bend } = BODY.cheeringArm;
    return {
      legs: [standingLeg, standingLeg],
      arms: [
        { swing: -swing, bend: -bend },
        { swing, bend },
      ],
      lean: 0,
    };
  }
  // Standing, the stick man's arms hang a little apart: one behind it, one in front.
  return {
    legs: [standingLeg, standingLeg],
    arms: [
      { swing: -BODY.restingArm, bend: BODY.restingArm },
      { swing: BODY.restingArm, bend: BODY.restingArm },
    ],
    lean: 0,
  };
}

/** The limbs `share` of the way from `from` to `to`: 0 is `from`, 1 is `to`. */
function blendBetween(start: Limbs, end: Limbs, share: number): Limbs {
  const mix = (start: number, end: number): number => start + (end - start) * share;
  const mixLimb = (start: Limb, end: Limb): Limb => ({
    swing: mix(start.swing, end.swing),
    bend: mix(start.bend, end.bend),
  });
  return {
    legs: [mixLimb(start.legs[0], end.legs[0]), mixLimb(start.legs[1], end.legs[1])],
    arms: [mixLimb(start.arms[0], end.arms[0]), mixLimb(start.arms[1], end.arms[1])],
    lean: mix(start.lean, end.lean),
  };
}

/** `share` from 0 to 1, starting and ending gently (smoothstep). */
function smooth(share: number): number {
  return share * share * (3 - 2 * share);
}

/**
 * A leg at `cycle` of the walk. For the first half of its cycle the foot is
 * planted: it goes back under the stick man at the speed the stick man goes forward, on a straight
 * leg. For the second half the leg swings forward again with the knee bent.
 */
function getWalkingLeg(cycle: number): Limb {
  const within = ((cycle % 1) + 1) % 1;
  if (within < 0.5) {
    return {
      swing: Math.asin((STEP_REACH * (1 - 4 * within)) / (BODY.thigh + BODY.shin)),
      bend: BODY.restingKnee,
    };
  }
  const swung = (within - 0.5) * 2;
  return {
    swing: -BODY.thighSwing * Math.cos(Math.PI * swung) + BODY.kneeLift * Math.sin(Math.PI * swung),
    bend: BODY.restingKnee + BODY.kneeBend * Math.sin(Math.PI * swung),
  };
}

/** An arm that is forward when the leg at `cycle` is forward. */
function getWalkingArm(cycle: number): Limb {
  const turn = cycle * Math.PI * 2;
  return {
    swing: BODY.armSwing * Math.cos(turn),
    bend: BODY.elbowBend * (1 + 0.5 * Math.cos(turn)),
  };
}

/** Hip, knee and foot of one leg. The knee bends backward. */
function buildLegFrom(hip: Point, limb: Limb, facing: 1 | -1): Point[] {
  const knee = stepFrom(hip, { angle: limb.swing, length: BODY.thigh, facing });
  return [hip, knee, stepFrom(knee, { angle: limb.swing - limb.bend, length: BODY.shin, facing })];
}

/** Shoulder, elbow and hand of one arm. The elbow bends forward. */
function buildArmFrom(shoulder: Point, limb: Limb, facing: 1 | -1): Point[] {
  const elbow = stepFrom(shoulder, { angle: limb.swing, length: BODY.upperArm, facing });
  return [
    shoulder,
    elbow,
    stepFrom(elbow, { angle: limb.swing + limb.bend, length: BODY.forearm, facing }),
  ];
}

/** The point `length` away from `from`, at `angle` from straight down, forward being the way the stick man faces. */
function stepFrom(start: Point, step: { angle: number; length: number; facing: 1 | -1 }): Point {
  return {
    x: start.x + Math.sin(step.angle) * step.length * step.facing,
    y: start.y + Math.cos(step.angle) * step.length,
  };
}

const HEAD_CORNERS = 18;

function buildCircleAround(centre: Point, radius: number): Point[] {
  return Array.from({ length: HEAD_CORNERS }, (_, corner) => {
    // Start at the top, where a hand starts a circle.
    const angle = (corner / HEAD_CORNERS) * Math.PI * 2 - Math.PI / 2;
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
  });
}

const convertPointToPixels = (point: Point): StrokePoint => ({
  x: convertToPixels(point.x),
  y: convertToPixels(point.y),
});

export const __testing__ = { getSkeleton, BODY, EASING, LINE_CLEARANCE };
