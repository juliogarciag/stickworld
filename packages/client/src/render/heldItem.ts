import type { Point, SpearView, StickManView } from '@stickworld/sim';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/**
 * The spear in the stick man's hand, as pencil strokes: a sheet of paper rolled tight, wide at
 * the end it is held by and coming to a point. Standing, walking and jumping it is held upright
 * at its side like a staff. In a thrust it is drawn along the line the sim tests (`getSpear`):
 * level, its point where the sim has it; while it is drawn back it comes upright again. Struck
 * down, the stick man lets go of it and it lies on the floor. Whether it holds one and where a
 * thrust is are the sim's; how it is held and what it looks like are decided here.
 */

/** The spear as it is drawn, in metres. */
export interface HeldSpear {
  /** Its wide end and its point. */
  readonly butt: Point;
  readonly tip: Point;
  /** Where the stick man's hand holds it, or null when it lies on the floor. */
  readonly hand: Point | null;
}

/**
 * The spear in the stick man's hand as it is drawn right now, or undefined when it holds none
 * (`spear` is what `getSpear` gave), and while it is seated.
 */
export function getHeldSpear(
  stickMan: StickManView,
  spear: SpearView | undefined,
): HeldSpear | undefined {
  const isShown = spear !== undefined && stickMan.action !== 'seated';
  if (!isShown) {
    return undefined;
  }
  const { feet, facing } = stickMan;
  const length = Math.abs(spear.tip.x - spear.butt.x);
  if (stickMan.action === 'struck') {
    // It falls the way the stick man does, and lies along the floor in front of where it
    // stood.
    const side = stickMan.struckDirection;
    const y = feet.y - ROLL.lyingAboveFloor;
    return {
      butt: { x: feet.x + side * ROLL.lyingAhead, y },
      tip: { x: feet.x + side * (ROLL.lyingAhead + length), y },
      hand: null,
    };
  }
  const atRest: Hold = {
    hand: { x: feet.x + facing * ROLL.handAhead, y: feet.y - ROLL.handHeight },
    direction: facing,
    rise: Math.PI / 2 - ROLL.lean,
    gripFromButt: ROLL.gripFromButt,
  };
  const hold = blendHolds(atRest, spear);
  const shaftDirection = { x: hold.direction * Math.cos(hold.rise), y: -Math.sin(hold.rise) };
  const getPointAlong = (distance: number): Point => ({
    x: hold.hand.x + shaftDirection.x * distance,
    y: hold.hand.y + shaftDirection.y * distance,
  });
  return {
    butt: getPointAlong(-hold.gripFromButt),
    tip: getPointAlong(length - hold.gripFromButt),
    hand: hold.hand,
  };
}

/**
 * The strokes that draw `spear`, in world pixels: the outline of the roll, from its wide end to
 * its point, and the edge of the sheet winding round it.
 */
export function buildHeldSpearStrokes(spear: HeldSpear): Stroke[] {
  const length = Math.hypot(spear.tip.x - spear.butt.x, spear.tip.y - spear.butt.y);
  const shaftDirection = {
    x: (spear.tip.x - spear.butt.x) / length,
    y: (spear.tip.y - spear.butt.y) / length,
  };
  // `lengthShare` of the way from the wide end to the point, and `side` of the way from its
  // middle to its edge there: 1 on one side, -1 on the other. The roll narrows evenly.
  const getPoint = (lengthShare: number, side: number): StrokePoint => {
    const distance = lengthShare * length;
    const across = side * (ROLL.width / 2) * (1 - lengthShare);
    return {
      x: convertToPixels(spear.butt.x + shaftDirection.x * distance - shaftDirection.y * across),
      y: convertToPixels(spear.butt.y + shaftDirection.y * distance + shaftDirection.x * across),
    };
  };
  return [
    { points: [getPoint(0, -1), getPoint(1, 0), getPoint(0, 1)], thickness: FINE, isClosed: true },
    ...ROLL.windings.map((winding) => ({
      points: [getPoint(winding.start, 1), getPoint(winding.end, -1)],
      thickness: FINE,
    })),
  ];
}

// ---- Helpers ----

/** How the spear is held and how it looks, in metres and radians. View detail only. */
const ROLL = {
  /** How wide the roll is at the end it is held by. It comes to a point at the other. */
  width: 0.15,
  /**
   * Where the edge of the sheet crosses the roll, as shares of its length: each from one side of
   * it to the other, slanting towards the point.
   */
  windings: [
    { start: 0.04, end: 0.26 },
    { start: 0.32, end: 0.54 },
  ],
  /**
   * Held at rest: where the hand is, in front of the stick man's middle and above its feet, how
   * far from the wide end it holds, and how far the top leans forward from upright.
   */
  handAhead: 0.3,
  handHeight: 0.95,
  gripFromButt: 0.75,
  lean: 0.1,
  /** In a thrust the hand is near the wide end, behind the whole reach of the spear. */
  gripFromButtInThrust: 0.15,
  /**
   * Lying on the floor by the stick man that was struck down: how far in front of its feet it
   * begins, and how far above the floor line its middle is drawn, so that its lower edge rests on
   * the line.
   */
  lyingAhead: 0.25,
  lyingAboveFloor: 0.11,
  /** How heavy its lines are, as a share of a usual line: it is a small thing. */
  finePencil: 0.6,
} as const;

const FINE = PENCIL.thickness * ROLL.finePencil;

/** One way of holding the spear: where the hand is, and how the spear lies through it. */
interface Hold {
  readonly hand: Point;
  /** Which side its point is on: 1 to the right, -1 to the left. */
  readonly direction: 1 | -1;
  /** How far its point is lifted from level, in radians: a quarter turn is upright. */
  readonly rise: number;
  readonly gripFromButt: number;
}

/**
 * How the spear is held with a thrust as far along as `spear` says: at rest while it is ready,
 * level along the sim's line while it goes out, and from there back to rest as it is drawn back.
 */
function blendHolds(atRest: Hold, spear: SpearView): Hold {
  if (spear.action === 'ready') {
    return atRest;
  }
  const inThrust: Hold = {
    hand: { x: spear.butt.x + spear.direction * ROLL.gripFromButtInThrust, y: spear.butt.y },
    direction: spear.direction,
    rise: 0,
    gripFromButt: ROLL.gripFromButtInThrust,
  };
  if (spear.action === 'thrusting') {
    return inThrust;
  }
  const share = smooth(spear.progress);
  const mix = (start: number, end: number): number => start + (end - start) * share;
  // Turned round since the thrust began, the stick man brings it up on the side it thrust to.
  const restRise = spear.direction === atRest.direction ? atRest.rise : Math.PI - atRest.rise;
  return {
    hand: { x: mix(inThrust.hand.x, atRest.hand.x), y: mix(inThrust.hand.y, atRest.hand.y) },
    direction: spear.direction,
    rise: mix(0, restRise),
    gripFromButt: mix(inThrust.gripFromButt, atRest.gripFromButt),
  };
}

/** `share` from 0 to 1, starting and ending gently (smoothstep). */
function smooth(share: number): number {
  return share * share * (3 - 2 * share);
}

export const __testing__ = { ROLL };
