import {
  PENCIL_ITEM_ID,
  SPEAR_ITEM_ID,
  type Point,
  type SpearView,
  type StickManView,
} from '@stickworld/sim';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/**
 * What the stick man holds in its hand, as pencil strokes: the pencil the letter gave it, as long
 * as the stick man is tall, and the spear that pencil is once it is sharpened. Standing, walking
 * and jumping it is held upright at its side like a staff. In a thrust the spear is drawn along
 * the line the sim tests (`getSpear`): level, its point where the sim has it; while it is drawn
 * back it comes upright again. Struck down, the stick man lets go of it and it lies on the floor.
 * Which item it is and where a thrust is are the sim's; how it is held is decided here.
 */

/** A pencil or a spear as it is drawn, in metres. */
export interface HeldItem {
  /** Its blunt end and its other end: the point of a spear, the flat end of a pencil. */
  readonly butt: Point;
  readonly tip: Point;
  /** How thick its shaft is. */
  readonly width: number;
  /** True for the spear: its end is sharpened to a point. */
  readonly isSharp: boolean;
  /** Where the stick man's hand holds it, or null when it lies on the floor. */
  readonly hand: Point | null;
}

/**
 * The pencil or the spear in the stick man's hand as it is drawn right now, or undefined when the
 * item in its hand is neither, and while it is seated.
 */
export function getHeldItem(held: {
  readonly stickMan: StickManView;
  /** The def id of the item in the selected slot, or null when there is none. */
  readonly itemDefId: number | null;
  /** The spear as the sim has it, when the item is the spear. */
  readonly spear: SpearView | undefined;
}): HeldItem | undefined {
  const isShaft = held.itemDefId === PENCIL_ITEM_ID || held.itemDefId === SPEAR_ITEM_ID;
  const isShown = isShaft && held.stickMan.action !== 'seated';
  if (!isShown) {
    return undefined;
  }
  const { feet, facing } = held.stickMan;
  const isSharp = held.itemDefId === SPEAR_ITEM_ID;
  const length = held.spear ? Math.abs(held.spear.tip.x - held.spear.butt.x) : SHAFT.length;
  const width = held.spear?.thickness ?? SHAFT.width;
  if (held.stickMan.action === 'struck') {
    // It falls the way the stick man does, and lies along the floor in front of where it
    // stood.
    const side = held.stickMan.struckDirection;
    const y = feet.y - SHAFT.lyingAboveFloor;
    return {
      butt: { x: feet.x + side * SHAFT.lyingAhead, y },
      tip: { x: feet.x + side * (SHAFT.lyingAhead + length), y },
      width,
      isSharp,
      hand: null,
    };
  }
  const atRest: Hold = {
    hand: { x: feet.x + facing * SHAFT.handAhead, y: feet.y - SHAFT.handHeight },
    direction: facing,
    rise: Math.PI / 2 - SHAFT.lean,
    gripFromButt: SHAFT.gripFromButt,
  };
  const hold = held.spear ? blendHolds(atRest, held.spear) : atRest;
  const shaftDirection = { x: hold.direction * Math.cos(hold.rise), y: -Math.sin(hold.rise) };
  const getPointAlong = (distance: number): Point => ({
    x: hold.hand.x + shaftDirection.x * distance,
    y: hold.hand.y + shaftDirection.y * distance,
  });
  return {
    butt: getPointAlong(-hold.gripFromButt),
    tip: getPointAlong(length - hold.gripFromButt),
    width,
    isSharp,
    hand: hold.hand,
  };
}

/**
 * The strokes that draw `item`, in world pixels: its shaft with a band near its blunt end, and for
 * a spear the cone it is sharpened to, with its lead.
 */
export function buildHeldItemStrokes(item: HeldItem): Stroke[] {
  const length = Math.hypot(item.tip.x - item.butt.x, item.tip.y - item.butt.y);
  const shaftDirection = {
    x: (item.tip.x - item.butt.x) / length,
    y: (item.tip.y - item.butt.y) / length,
  };
  const getPoint = (distance: number, across: number): StrokePoint => ({
    x: convertToPixels(
      item.butt.x + shaftDirection.x * distance - shaftDirection.y * across * item.width,
    ),
    y: convertToPixels(
      item.butt.y + shaftDirection.y * distance + shaftDirection.x * across * item.width,
    ),
  });
  const buildLineAcross = (distance: number, halfWidth: number): Stroke => ({
    points: [getPoint(distance, -halfWidth), getPoint(distance, halfWidth)],
    thickness: FINE,
  });
  const shaftEnd = item.isSharp ? length - SHAFT.pointLength : length;
  const outline = [
    getPoint(0, -0.5),
    getPoint(shaftEnd, -0.5),
    ...(item.isSharp ? [getPoint(length, 0)] : []),
    getPoint(shaftEnd, 0.5),
    getPoint(0, 0.5),
  ];
  return [
    { points: outline, thickness: FINE, isClosed: true },
    buildLineAcross(SHAFT.bandFromButt, 0.5),
    ...(item.isSharp
      ? [
          buildLineAcross(shaftEnd, 0.5),
          buildLineAcross(length - SHAFT.pointLength * SHAFT.leadShare, SHAFT.leadShare / 2),
        ]
      : []),
  ];
}

// ---- Helpers ----

/** How a pencil or a spear is held and how it looks, in metres and radians. View detail only. */
const SHAFT = {
  /** How long and how thick the pencil is: as the spear the sim has, which is made of it. */
  length: 1.7,
  width: 0.08,
  /**
   * Held at rest: where the hand is, in front of the stick man's middle and above its feet, how
   * far from the blunt end it holds, and how far the top leans forward from upright.
   */
  handAhead: 0.3,
  handHeight: 0.95,
  gripFromButt: 0.75,
  lean: 0.1,
  /** In a thrust the hand is near the blunt end, behind the whole reach of the spear. */
  gripFromButtInThrust: 0.15,
  /**
   * Lying on the floor by the stick man that was struck down: how far in front of its feet it
   * begins, and how far above the floor line it is drawn, so the two lines do not run into one.
   */
  lyingAhead: 0.25,
  lyingAboveFloor: 0.07,
  /** The band near the blunt end, and the cone a spear is sharpened to with its lead. */
  bandFromButt: 0.16,
  pointLength: 0.26,
  leadShare: 0.35,
  /** How heavy its lines are, as a share of a usual line: it is a small thing. */
  finePencil: 0.6,
} as const;

const FINE = PENCIL.thickness * SHAFT.finePencil;

/** One way of holding a shaft: where the hand is, and how the shaft lies through it. */
interface Hold {
  readonly hand: Point;
  /** Which side its far end is on: 1 to the right, -1 to the left. */
  readonly direction: 1 | -1;
  /** How far its far end is lifted from level, in radians: a quarter turn is upright. */
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
    hand: { x: spear.butt.x + spear.direction * SHAFT.gripFromButtInThrust, y: spear.butt.y },
    direction: spear.direction,
    rise: 0,
    gripFromButt: SHAFT.gripFromButtInThrust,
  };
  if (spear.action === 'thrusting') {
    return inThrust;
  }
  // Turned round since the thrust began, the stick man brings it up on the side it thrust to.
  const share = smooth(spear.progress);
  const mix = (start: number, end: number): number => start + (end - start) * share;
  return {
    hand: { x: mix(inThrust.hand.x, atRest.hand.x), y: mix(inThrust.hand.y, atRest.hand.y) },
    direction: spear.direction,
    rise: mix(0, spear.direction === atRest.direction ? atRest.rise : Math.PI - atRest.rise),
    gripFromButt: mix(inThrust.gripFromButt, atRest.gripFromButt),
  };
}

/** `share` from 0 to 1, starting and ending gently (smoothstep). */
function smooth(share: number): number {
  return share * share * (3 - 2 * share);
}

export const __testing__ = { SHAFT };
