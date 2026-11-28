import type { EnemyView, Point } from '@stickworld/sim';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/**
 * The club enemy as pencil strokes: a box seen a little from the side, with a peaked top, two
 * scribbled eyes and a wavy mouth on the face it turns to the stick man, a small round hand at its
 * back, and an arm that holds a wide, dotted club. Where it is, which way it looks and where its
 * arm and club are come from the sim, which tests the club exactly where it is drawn; everything
 * else here is how it looks, and view detail only.
 */

/** Its shape, as shares of its body's width and height unless said otherwise. */
const LOOK = {
  /** How much of its width is the side it shows beside its face. */
  sideWidth: 0.22,
  /** How much of its height the peak of its top takes. */
  peakHeight: 0.13,
  /** How much higher the far edge of its side is drawn: what makes the box look deep. */
  sideRise: 0.05,
  /** Where its eyes are on its face: how far apart, how high, and how big. */
  eyeSpacing: 0.19,
  eyeHeight: 0.66,
  eyeRadius: 0.065,
  /** A brow over each eye while it means to strike: how long, and how far it slants. */
  browLength: 0.2,
  browSlant: 0.09,
  browAbove: 0.13,
  /** Its mouth: how wide, how high on its face, how many waves and how deep. */
  mouthWidth: 0.5,
  mouthHeight: 0.28,
  mouthWaves: 3,
  mouthDepth: 0.035,
  /** The hand at its back and the hand on the club, in metres. */
  handRadius: 0.07,
  /** How far behind its body the hand at its back is, in metres. */
  backHandBehind: 0.1,
  /** How wide the club is where the hand holds it, as a share of how thick it is at its end. */
  clubWidthAtGrip: 0.45,
  /** How many dots the club has along it. */
  clubDots: 5,
  /** How long a dot is, in metres. */
  dotLength: 0.03,
  /** It floats: how far it bobs up and down, in metres, and how many times a second. */
  bobHeight: 0.015,
  bobsPerSecond: 0.55,
} as const;

/** The pencil for its eyes, brows, mouth and the dots of its club: a finer line. */
const FINE = PENCIL.thickness * 0.75;

/**
 * The strokes that draw `enemy`, in world pixels. `seconds` is the view's own clock, for the way it
 * bobs as it floats.
 */
export function buildEnemyStrokes(enemy: EnemyView, seconds: number): Stroke[] {
  const bob = LOOK.bobHeight * Math.sin(seconds * LOOK.bobsPerSecond * Math.PI * 2);
  const lift = (point: Point): Point => ({ x: point.x, y: point.y + bob });
  const isAboutToStrike = enemy.action === 'windingUp' || enemy.action === 'swinging';
  return [
    ...buildBodyLines(enemy),
    ...buildFaceLines(enemy, isAboutToStrike),
    ...buildArmAndClubLines(enemy),
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
function getBodyPoint(enemy: EnemyView, forward: number, up: number): Point {
  return { x: enemy.position.x + forward * enemy.facing, y: enemy.position.y - up };
}

/** The part of its body that is its face: from where its side ends to its front edge. */
function getFace(enemy: EnemyView): { back: number; front: number; top: number } {
  return {
    back: -enemy.width / 2 + enemy.width * LOOK.sideWidth,
    front: enemy.width / 2,
    top: enemy.height * (1 - LOOK.peakHeight),
  };
}

/** The box: its face, the side beside it, the peak of its top, and the hand at its back. */
function buildBodyLines(enemy: EnemyView): Line[] {
  const face = getFace(enemy);
  const farEdge = -enemy.width / 2;
  const rise = enemy.height * LOOK.sideRise;
  const peak = getBodyPoint(enemy, (face.back + face.front) / 2 - enemy.width * 0.1, enemy.height);
  const faceTopFront = getBodyPoint(enemy, face.front, face.top);
  const faceTopBack = getBodyPoint(enemy, face.back, face.top);
  const sideTop = getBodyPoint(enemy, farEdge, face.top + rise * 0.4);
  const backHand = getBodyPoint(enemy, farEdge - LOOK.backHandBehind, enemy.height * 0.45);
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
    { points: buildCircleAround(backHand, LOOK.handRadius), isClosed: true },
  ];
}

/** Two scribbled eyes and a wavy mouth, and a brow over each eye while it means to strike. */
function buildFaceLines(enemy: EnemyView, isAboutToStrike: boolean): Line[] {
  const face = getFace(enemy);
  const middle = (face.back + face.front) / 2;
  const eyeUp = face.top * LOOK.eyeHeight;
  const lines: Line[] = [];
  for (const side of [-1, 1]) {
    const eyeForward = middle + side * enemy.width * LOOK.eyeSpacing;
    lines.push({
      points: buildScribbleAround(
        getBodyPoint(enemy, eyeForward, eyeUp),
        enemy.width * LOOK.eyeRadius,
      ),
      isFine: true,
    });
    if (isAboutToStrike) {
      // Each brow comes down towards the middle of its face: a frown.
      const browUp = eyeUp + enemy.height * LOOK.browAbove;
      const half = (enemy.width * LOOK.browLength) / 2;
      const slant = enemy.height * LOOK.browSlant * side;
      lines.push({
        points: [
          getBodyPoint(enemy, eyeForward - half, browUp - slant / 2),
          getBodyPoint(enemy, eyeForward + half, browUp + slant / 2),
        ],
        isFine: true,
      });
    }
  }
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
function buildArmAndClubLines(enemy: EnemyView): Line[] {
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
  // The rounded end is drawn inside the club's length: the sim's club ends at `tip`.
  const shoulderOfEnd = length - halfAtEnd * 0.6;
  const dots: Line[] = Array.from({ length: LOOK.clubDots }, (_, dot) => {
    const share = (dot + 1) / (LOOK.clubDots + 1);
    const aside = (dot % 2 === 0 ? 1 : -1) * (halfAtGrip + (halfAtEnd - halfAtGrip) * share) * 0.4;
    const distance = length * share;
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
        getClubPoint(shoulderOfEnd, halfAtEnd),
        getClubPoint(length, halfAtEnd * 0.5),
        getClubPoint(length, -halfAtEnd * 0.5),
        getClubPoint(shoulderOfEnd, -halfAtEnd),
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
    const angle = (corner / SCRIBBLE_CORNERS) * Math.PI * 4.5;
    const distance = radius * (1 - (0.75 * corner) / SCRIBBLE_CORNERS);
    return { x: centre.x + Math.cos(angle) * distance, y: centre.y + Math.sin(angle) * distance };
  });
}

const convertPointToPixels = (point: Point): StrokePoint => ({
  x: convertToPixels(point.x),
  y: convertToPixels(point.y),
});

export const __testing__ = { LOOK };
