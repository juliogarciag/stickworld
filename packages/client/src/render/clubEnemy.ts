import type { ClubEnemyView, Point } from '@stickworld/sim';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/**
 * The club enemy as pencil strokes: a box seen a little from the side, with a peaked top, two
 * scribbled eyes and a wavy mouth on the face it turns to the stick man, a short arm with a round
 * hand at its back, and an arm that holds a wide, dotted club. Where it is, which way it looks
 * and where its arm and club are come from the sim: the club is drawn along the line the sim
 * tests, as thick at its end as the sim has it (the sim's test reaches half that thickness past
 * the end, too). Everything else here is how it looks, and view detail only.
 */

/** Its shape, as shares of its body's width and height unless said otherwise. */
const LOOK = {
  /** How much of its width is the side it shows beside its face. */
  sideWidth: 0.22,
  /** How much of its height the peak of its top takes. */
  peakHeight: 0.13,
  /** How much higher the far edge of its side is drawn: what makes the box look deep. */
  sideRise: 0.05,
  /** How much of that rise the top of the far edge has. */
  sideRiseAtTop: 0.4,
  /** How far behind the middle of its face the peak is, as a share of its width. */
  peakBehind: 0.1,
  /** Where its eyes are on its face: how far apart, how high, and how big. */
  eyeSpacing: 0.19,
  eyeHeight: 0.84,
  eyeRadius: 0.065,
  /** A brow over each eye while it means to strike: how long, and how far it slants. */
  browLength: 0.2,
  browSlant: 0.09,
  browAbove: 0.1,
  /** Its mouth: how wide, how high on its face, how many waves and how deep. */
  mouthWidth: 0.5,
  mouthHeight: 0.36,
  mouthWaves: 3,
  mouthDepth: 0.035,
  /** The hand at its back and the hand on the club, in metres. */
  handRadius: 0.07,
  /** How far behind its body the hand at its back is, in metres, and how high up its body. */
  /**
   * Its other arm, at its back: where it leaves its body, and where its elbow and hand are while it
   * hangs and while it is thrown up and back for a swing. Each is how far behind its body, in
   * metres, and how high up its body, as a share of its height.
   */
  backArm: {
    shoulderHeight: 0.62,
    hanging: { elbow: { behind: 0.17, height: 0.5 }, hand: { behind: 0.2, height: 0.33 } },
    thrownUp: { elbow: { behind: 0.24, height: 0.66 }, hand: { behind: 0.2, height: 0.9 } },
  },
  /** How wide the club is where the hand holds it, as a share of how thick it is at its end. */
  clubWidthAtGrip: 0.45,
  /** The rounded end of the club: how far from the end it starts to narrow, and to how much. */
  clubEndLength: 0.6,
  clubEndWidth: 0.5,
  /** How far from the middle of the club its dots are, as a share of its half width there. */
  dotAside: 0.4,
  /** How many dots the club has along it. */
  clubDots: 5,
  /** How long a dot is, in metres. */
  dotLength: 0.03,
  /** It floats: how far it bobs up and down, in metres, and how many times a second. */
  bobHeight: 0.015,
  bobsPerSecond: 0.55,
  /** A scribbled eye: how many times the pencil goes round, and how far in it ends up. */
  scribbleTurns: 2.25,
  scribbleInward: 0.75,
  /** The pencil for its eyes, brows, mouth and dots, as a share of the usual thickness. */
  finePencil: 0.75,
} as const;

/** The pencil for its eyes, brows, mouth and the dots of its club: a finer line. */
const FINE = PENCIL.thickness * LOOK.finePencil;

/**
 * The same drawing in its parts, still and without brows: its body, its face, the arm that holds
 * the club, and the club. For what takes it apart (`tornClubEnemy.ts`). In world pixels.
 */
export function buildClubEnemyParts(enemy: ClubEnemyView): {
  body: Stroke[];
  face: Stroke[];
  arm: Stroke[];
  club: Stroke[];
} {
  const convertLine = (line: Line): Stroke => ({
    points: line.points.map(convertPointToPixels),
    thickness: line.isFine ? FINE : PENCIL.thickness,
    isClosed: line.isClosed,
  });
  const armAndClub = buildArmAndClubLines(enemy).map(convertLine);
  return {
    body: buildBodyLines(enemy).map(convertLine),
    face: buildFaceLines(enemy).map(convertLine),
    arm: armAndClub.slice(0, 2),
    club: armAndClub.slice(2),
  };
}

/**
 * The strokes that draw `enemy`, in world pixels. `seconds` is the view's own clock, for the way it
 * bobs as it floats.
 */
export function buildClubEnemyStrokes(enemy: ClubEnemyView, seconds: number): Stroke[] {
  // A sheet that is being turned away has no clock of its own (its time is endless): the enemy on
  // it is still.
  const bob = Number.isFinite(seconds)
    ? LOOK.bobHeight * Math.sin(seconds * LOOK.bobsPerSecond * Math.PI * 2)
    : 0;
  const lift = (point: Point): Point => ({ x: point.x, y: point.y + bob });
  const isAboutToStrike = enemy.action === 'windingUp' || enemy.action === 'swinging';
  // The brows come and go: they are last, so that no other line's place in the list changes with
  // them. A stroke's wobble comes from its place.
  return [
    ...buildBodyLines(enemy),
    ...buildFaceLines(enemy),
    ...buildArmAndClubLines(enemy),
    ...(isAboutToStrike ? buildBrowLines(enemy) : []),
  ].map((line) => ({
    points: line.points.map(lift).map(convertPointToPixels),
    thickness: line.isFine ? FINE : PENCIL.thickness,
    isClosed: line.isClosed,
  }));
}

// ---- Helpers ----

/** A line in metres, before it is a stroke. */
interface Line {
  readonly points: readonly Point[];
  readonly isClosed?: boolean;
  readonly isFine?: boolean;
}

/**
 * Where a point of its body is: `forward` metres from its middle the way it faces, `up` metres
 * above its underside.
 */
function getBodyPoint(enemy: ClubEnemyView, forward: number, up: number): Point {
  return { x: enemy.position.x + forward * enemy.facing, y: enemy.position.y - up };
}

/** The part of its body that is its face: from where its side ends to its front edge. */
function getFace(enemy: ClubEnemyView): { back: number; front: number; top: number } {
  return {
    back: -enemy.width / 2 + enemy.width * LOOK.sideWidth,
    front: enemy.width / 2,
    top: enemy.height * (1 - LOOK.peakHeight),
  };
}

/**
 * How far into the pose of a swing the enemy is, from 0, at rest, to 1: it gets into it as the
 * club goes back, holds it through the swing, and leaves it as the club is lifted again. How far
 * along each of those it is comes from the sim.
 */
function getShareOfSwingPose(enemy: ClubEnemyView): number {
  if (enemy.action === 'windingUp') {
    return enemy.progress;
  }
  if (enemy.action === 'swinging') {
    return 1;
  }
  return enemy.action === 'recovering' ? 1 - enemy.progress : 0;
}

/** `share` from 0 to 1, starting and ending gently (smoothstep). */
function smooth(share: number): number {
  return share * share * (3 - 2 * share);
}

/** The box: its face, the side beside it, the peak of its top, and its other arm at its back. */
function buildBodyLines(enemy: ClubEnemyView): Line[] {
  const face = getFace(enemy);
  const farEdge = -enemy.width / 2;
  const rise = enemy.height * LOOK.sideRise;
  const peak = getBodyPoint(
    enemy,
    (face.back + face.front) / 2 - enemy.width * LOOK.peakBehind,
    enemy.height,
  );
  const faceTopFront = getBodyPoint(enemy, face.front, face.top);
  const faceTopBack = getBodyPoint(enemy, face.back, face.top);
  const sideTop = getBodyPoint(enemy, farEdge, face.top + rise * LOOK.sideRiseAtTop);
  const backArm = LOOK.backArm;
  // Its other arm goes up and back as the club does, and comes down again as the club is lifted.
  const thrownUp = smooth(getShareOfSwingPose(enemy));
  const getArmPoint = (joint: 'elbow' | 'hand'): Point => {
    const hanging = backArm.hanging[joint];
    const up = backArm.thrownUp[joint];
    return getBodyPoint(
      enemy,
      farEdge - (hanging.behind + (up.behind - hanging.behind) * thrownUp),
      enemy.height * (hanging.height + (up.height - hanging.height) * thrownUp),
    );
  };
  const backHand = getArmPoint('hand');
  return [
    {
      points: [
        getBodyPoint(enemy, face.front, 0),
        faceTopFront,
        faceTopBack,
        getBodyPoint(enemy, face.back, 0),
      ],
      isClosed: true,
    },
    { points: [faceTopBack, sideTop, getBodyPoint(enemy, farEdge, rise)] },
    { points: [getBodyPoint(enemy, farEdge, rise), getBodyPoint(enemy, face.back, 0)] },
    { points: [faceTopFront, peak, faceTopBack] },
    { points: [peak, sideTop] },
    {
      points: [
        getBodyPoint(enemy, farEdge, enemy.height * backArm.shoulderHeight),
        getArmPoint('elbow'),
        backHand,
      ],
    },
    { points: buildCircleAround(backHand, LOOK.handRadius), isClosed: true },
  ];
}

/** Where its eyes are: how far forward of its middle each is, and how high up its body. */
function getEyes(enemy: ClubEnemyView): { forward: readonly [number, number]; up: number } {
  const face = getFace(enemy);
  const middle = (face.back + face.front) / 2;
  const spacing = enemy.width * LOOK.eyeSpacing;
  return { forward: [middle - spacing, middle + spacing], up: face.top * LOOK.eyeHeight };
}

/** A brow over each eye, each coming down towards the middle of its face: a frown. */
function buildBrowLines(enemy: ClubEnemyView): Line[] {
  const eyes = getEyes(enemy);
  const browUp = eyes.up + enemy.height * LOOK.browAbove;
  const half = (enemy.width * LOOK.browLength) / 2;
  return eyes.forward.map((eyeForward, index) => {
    const slant = enemy.height * LOOK.browSlant * (index === 0 ? -1 : 1);
    return {
      points: [
        getBodyPoint(enemy, eyeForward - half, browUp - slant / 2),
        getBodyPoint(enemy, eyeForward + half, browUp + slant / 2),
      ],
      isFine: true,
    };
  });
}

/** Two scribbled eyes and a wavy mouth. */
function buildFaceLines(enemy: ClubEnemyView): Line[] {
  const face = getFace(enemy);
  const middle = (face.back + face.front) / 2;
  const eyes = getEyes(enemy);
  const lines: Line[] = eyes.forward.map((eyeForward) => ({
    points: buildScribbleAround(
      getBodyPoint(enemy, eyeForward, eyes.up),
      enemy.width * LOOK.eyeRadius,
    ),
    isFine: true,
  }));
  const mouthUp = face.top * LOOK.mouthHeight;
  const mouthStart = middle - (enemy.width * LOOK.mouthWidth) / 2;
  const corners = LOOK.mouthWaves * 2;
  lines.push({
    points: Array.from({ length: corners + 1 }, (_, corner) =>
      getBodyPoint(
        enemy,
        mouthStart + (enemy.width * LOOK.mouthWidth * corner) / corners,
        mouthUp + (corner % 2 === 0 ? -1 : 1) * enemy.height * LOOK.mouthDepth,
      ),
    ),
    isFine: true,
  });
  return lines;
}

/**
 * Its arm from the shoulder to the hand, the hand, and the club from the hand to its end: wider at
 * the end, with dots along it. Exactly where the sim has them.
 */
function buildArmAndClubLines(enemy: ClubEnemyView): Line[] {
  const { shoulder, grip, tip, thickness } = enemy.club;
  const length = Math.hypot(tip.x - grip.x, tip.y - grip.y) || 1;
  const lengthwise = { x: (tip.x - grip.x) / length, y: (tip.y - grip.y) / length };
  const across = { x: -lengthwise.y, y: lengthwise.x };
  const getClubPoint = (distance: number, aside: number): Point => ({
    x: grip.x + lengthwise.x * distance + across.x * aside,
    y: grip.y + lengthwise.y * distance + across.y * aside,
  });
  const halfAtEnd = thickness / 2;
  const halfAtGrip = halfAtEnd * LOOK.clubWidthAtGrip;
  // The rounded end is drawn inside the club's length, which ends at the sim's `tip`.
  const endStart = length - halfAtEnd * LOOK.clubEndLength;
  const dots: Line[] = Array.from({ length: LOOK.clubDots }, (_, dot) => {
    const progress = (dot + 1) / (LOOK.clubDots + 1);
    const aside =
      (dot % 2 === 0 ? 1 : -1) * (halfAtGrip + (halfAtEnd - halfAtGrip) * progress) * LOOK.dotAside;
    const distance = length * progress;
    return {
      points: [getClubPoint(distance, aside), getClubPoint(distance + LOOK.dotLength, aside)],
      isFine: true,
    };
  });
  return [
    { points: [shoulder, grip] },
    { points: buildCircleAround(grip, LOOK.handRadius), isClosed: true },
    {
      points: [
        getClubPoint(0, halfAtGrip),
        getClubPoint(endStart, halfAtEnd),
        getClubPoint(length, halfAtEnd * LOOK.clubEndWidth),
        getClubPoint(length, -halfAtEnd * LOOK.clubEndWidth),
        getClubPoint(endStart, -halfAtEnd),
        getClubPoint(0, -halfAtGrip),
      ],
      isClosed: true,
    },
    ...dots,
  ];
}

const CIRCLE_CORNERS = 10;

function buildCircleAround(centre: Point, radius: number): Point[] {
  return Array.from({ length: CIRCLE_CORNERS }, (_, corner) => {
    const angle = (corner / CIRCLE_CORNERS) * Math.PI * 2 - Math.PI / 2;
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
  });
}

const SCRIBBLE_CORNERS = 14;

/** A scribble: the pencil going round and round on the spot, closing in on the middle. */
function buildScribbleAround(centre: Point, radius: number): Point[] {
  return Array.from({ length: SCRIBBLE_CORNERS }, (_, corner) => {
    const angle = (corner / SCRIBBLE_CORNERS) * Math.PI * 2 * LOOK.scribbleTurns;
    const distance = radius * (1 - (LOOK.scribbleInward * corner) / SCRIBBLE_CORNERS);
    return { x: centre.x + Math.cos(angle) * distance, y: centre.y + Math.sin(angle) * distance };
  });
}

const convertPointToPixels = (point: Point): StrokePoint => ({
  x: convertToPixels(point.x),
  y: convertToPixels(point.y),
});

export const __testing__ = { LOOK };
