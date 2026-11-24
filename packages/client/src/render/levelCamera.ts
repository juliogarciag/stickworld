import { STICK_MAN_HEIGHT, type FloorSegment, type StickManView } from '@stickworld/sim';
import type Phaser from 'phaser';
import { toPixels } from './units';

/** How the camera frames the level. View detail only. Metres and seconds. */
const FRAMING = {
  /** How many stick men tall the view is on a window wide enough for that: this, not the pixel ratio, decides how big things are on screen. */
  stickMenTall: 6,
  /** Where the floor under him sits, as a share of the view's height from the top. */
  floorFromTop: 0.72,
  /** The view never shows less than this much of the level across: a narrow window is held further from the sheet instead. */
  leastMetresAcross: 12,
  /** Looking ahead, he stands this share of the view's width from the side behind him, and the rest is where he is going. */
  fromTheSideBehindHim: 0.3,
  /** On the floor, facing the end of his line from this close or closer, with floor further on, he is at an edge. */
  nearAnEdge: 2.5,
  /** Looking ahead, this much of the next floor line has to be in view. */
  ofTheNextLine: 2.5,
  /** However far the next floor line is, the view is never pulled back to show more than this across (or the window's own width, when that shows more). */
  mostMetresAcross: 21,
  /** How long the view takes to get most of the way to where it is wanted. */
  easeSeconds: 0.4,
  /** A stick man who is this far from where he was a frame ago did not walk there: a level started, and the view cuts to it. */
  cutBeyond: 3,
  /** The fastest the view moves along the line to keep up with him, in metres a second: faster than anything he does, so only a hop in one tick (sitting down in the airplane) is taken over a few frames. */
  fastestFollow: 14,
} as const;

/** What the camera needs to know about him. */
export type Followed = Pick<StickManView, 'feet' | 'facing' | 'action' | 'carrying'>;

/** How the view sits on the level: how far ahead of his feet its middle is, and how much of the level it shows across. Metres. */
export interface Framing {
  readonly ahead: number;
  readonly metresAcross: number;
}

/**
 * Returns a function that points `camera` at the stick man, to call every
 * frame with the seconds since the last one. It follows him along the line,
 * and stays at the height of the floor he last stood on while his feet are
 * off it: a jump or a flight moves him on the screen, not the paper under
 * him. At an edge, carrying the airplane and seated in it, the view eases
 * ahead of him and pulls back until the next floor line is in it.
 */
export function followStickManWith(camera: Phaser.Cameras.Scene2D.Camera): (now: { stickMan: Followed; floor: readonly FloorSegment[]; seconds: number }) => void {
  let floorHeight: number | undefined;
  let shown: { framing: Framing; followedX: number } | undefined;
  return ({ stickMan, floor, seconds }) => {
    const { feet, action } = stickMan;
    if ((action !== 'jumping' && action !== 'seated') || floorHeight === undefined) floorHeight = feet.y;
    const wanted = framingWanted({ stickMan, floor, metresAcrossAtRest: metresAcrossAtRest(camera) });
    const cut = shown === undefined || Math.abs(feet.x - shown.followedX) > FRAMING.cutBeyond;
    shown = cut || !shown ? { framing: wanted, followedX: feet.x } : { framing: easedTowards(shown.framing, wanted, seconds), followedX: keptUpWith({ followedX: shown.followedX, feetX: feet.x, seconds }) };

    const zoom = camera.width / toPixels(shown.framing.metresAcross);
    camera.setZoom(zoom);
    camera.centerOn(toPixels(shown.followedX + shown.framing.ahead), toPixels(floorHeight) - ((FRAMING.floorFromTop - 0.5) * camera.height) / zoom);
  };
}

/**
 * The zoom at which `camera` shows the level while nothing pulls it back: the view is `FRAMING.stickMenTall` stick men
 * tall, or shows `FRAMING.leastMetresAcross` across when the window is too narrow for that. The HUD is always drawn
 * at this zoom, so its lines are as heavy as the level's and it keeps its size when the level's view pulls back.
 */
export function zoomAtRest(camera: Phaser.Cameras.Scene2D.Camera): number {
  return Math.min(camera.height / toPixels(FRAMING.stickMenTall * STICK_MAN_HEIGHT), camera.width / toPixels(FRAMING.leastMetresAcross));
}

/**
 * Where the view wants to be for him as he is now. Centred on him and as wide as it is at rest, unless he is looking
 * where he is going: then he stands to one side, and it is as much wider as it takes to show the next floor line.
 */
export function framingWanted({ stickMan, floor, metresAcrossAtRest }: { stickMan: Followed; floor: readonly FloorSegment[]; metresAcrossAtRest: number }): Framing {
  const { feet, facing, action, carrying } = stickMan;
  const looksAhead = carrying || action === 'seated' || (action !== 'jumping' && isAtAnEdge({ x: feet.x, facing, floor }));
  if (!looksAhead) return { ahead: 0, metresAcross: metresAcrossAtRest };
  const toTheNextLine = distanceToTheNextLine({ x: feet.x, facing, floor });
  const toShowIt = toTheNextLine === undefined ? 0 : (toTheNextLine + FRAMING.ofTheNextLine) / (1 - FRAMING.fromTheSideBehindHim);
  const metresAcross = Math.max(metresAcrossAtRest, Math.min(toShowIt, FRAMING.mostMetresAcross));
  return { ahead: facing * (0.5 - FRAMING.fromTheSideBehindHim) * metresAcross, metresAcross };
}

/** `from` a frame of `seconds` closer to `to`: most of the way there after `FRAMING.easeSeconds`, never past it. */
export function easedTowards(from: Framing, to: Framing, seconds: number): Framing {
  const share = 1 - Math.exp(-Math.max(0, seconds) / FRAMING.easeSeconds);
  return { ahead: from.ahead + (to.ahead - from.ahead) * share, metresAcross: from.metresAcross + (to.metresAcross - from.metresAcross) * share };
}

/**
 * Where along the line the view follows him to, a frame of `seconds` after it was at `followedX`: where his feet are,
 * unless they got there faster than `FRAMING.fastestFollow`, which only a hop within one tick does.
 */
export function keptUpWith({ followedX, feetX, seconds }: { followedX: number; feetX: number; seconds: number }): number {
  const furthest = FRAMING.fastestFollow * Math.max(0, seconds);
  return followedX + Math.max(-furthest, Math.min(furthest, feetX - followedX));
}

// ---- Helpers ----

function metresAcrossAtRest(camera: Phaser.Cameras.Scene2D.Camera): number {
  return camera.width / zoomAtRest(camera) / toPixels(1);
}

interface Looking {
  readonly x: number;
  readonly facing: 1 | -1;
  readonly floor: readonly FloorSegment[];
}

/** True when the end of the floor line under `x` that he faces is near, and there is floor further on to get to. */
function isAtAnEdge({ x, facing, floor }: Looking): boolean {
  const line = floor.find(({ from, to }) => from.x <= x && x <= to.x);
  if (!line) return false;
  const toTheEnd = facing === 1 ? line.to.x - x : x - line.from.x;
  return toTheEnd <= FRAMING.nearAnEdge && distanceToTheNextLine({ x, facing, floor }) !== undefined;
}

/** How far the way he faces the nearest floor line begins that he is not on or over, or undefined when there is none. */
function distanceToTheNextLine({ x, facing, floor }: Looking): number | undefined {
  const distances = floor.map(({ from, to }) => (facing === 1 ? from.x - x : x - to.x)).filter((distance) => distance > 0);
  return distances.length === 0 ? undefined : Math.min(...distances);
}

export const __testing__ = { FRAMING };
