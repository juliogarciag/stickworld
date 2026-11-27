import { STICK_MAN_HEIGHT, type FloorSegment, type StickManView } from '@stickworld/sim';
import type Phaser from 'phaser';
import { convertToPixels } from './units';

/** How the camera frames the level. View detail only. Metres and seconds. */
const FRAMING = {
  /**
   * How many stick men tall the view is on a window wide enough for that: this, not the pixel
   * ratio, decides how big things are on screen.
   */
  stickMenTall: 6,
  /** Where the floor under the stick man sits, as a share of the view's height from the top. */
  floorFromTop: 0.72,
  /**
   * The view never shows less than this much of the level across: a narrow window is held further
   * from the sheet instead.
   */
  leastMetresAcross: 12,
  /**
   * Looking ahead, the stick man stands this share of the view's width from the side behind it, and
   * the rest is where it is going.
   */
  trailingViewShare: 0.3,
  /**
   * On the floor, facing the end of the stick man's line from this close or closer, with floor
   * further on, it is at an edge.
   */
  edgeDistance: 2.5,
  /** Looking ahead, this much of the next floor line has to be in view. */
  nextLineMargin: 2.5,
  /**
   * However far the next floor line is, the view is never pulled back to show more than this across
   * (or the window's own width, when that shows more).
   */
  mostMetresAcross: 21,
  /** How long the view takes to get most of the way to where it is wanted. */
  easeSeconds: 0.4,
  /**
   * A stick man who is this far from where it was a frame ago did not walk there: a level started,
   * and the view cuts to it.
   */
  cutBeyond: 3,
  /**
   * The fastest the view moves along the line to keep up with the stick man, in metres a second:
   * faster than anything the stick man does, so only a hop in one tick (sitting down in the
   * airplane) is taken over a few frames.
   */
  fastestFollow: 14,
} as const;

/** What the camera needs to know about the stick man. */
export type Followed = Pick<StickManView, 'feet' | 'facing' | 'action' | 'isCarrying'>;

/**
 * How the view sits on the level: how far ahead of the stick man's feet its middle is, and how much
 * of the level it shows across. Metres.
 */
interface Framing {
  readonly metresAhead: number;
  readonly metresAcross: number;
}

/**
 * Returns a function that points `camera` at the stick man, to call every
 * frame with the seconds since the last one. It follows the stick man along the line,
 * and stays at the height of the floor the stick man last stood on while the stick man's feet are
 * off it: a jump or a flight moves the stick man on the screen, not the paper under
 * it. At an edge, carrying the airplane and seated in it, the view eases
 * ahead of the stick man and pulls back until the next floor line is in it.
 */
export function followStickManWith(
  camera: Phaser.Cameras.Scene2D.Camera,
): (now: { stickMan: Followed; floor: readonly FloorSegment[]; seconds: number }) => void {
  let floorHeight: number | undefined;
  let shown: { framing: Framing; followedX: number } | undefined;
  return (input) => {
    const { feet, action } = input.stickMan;
    if ((action !== 'jumping' && action !== 'seated') || floorHeight === undefined) {
      floorHeight = feet.y;
    }
    const wanted = getFramingWanted({
      stickMan: input.stickMan,
      floor: input.floor,
      metresAcrossAtRest: getMetresAcrossAtRest(camera),
    });
    const isCut = shown === undefined || Math.abs(feet.x - shown.followedX) > FRAMING.cutBeyond;
    shown =
      isCut || !shown
        ? { framing: wanted, followedX: feet.x }
        : {
            framing: easeTowards(shown.framing, wanted, input.seconds),
            followedX: keepUpWith({
              followedX: shown.followedX,
              feetX: feet.x,
              seconds: input.seconds,
            }),
          };

    const zoom = camera.width / convertToPixels(shown.framing.metresAcross);
    camera.setZoom(zoom);
    camera.centerOn(
      convertToPixels(shown.followedX + shown.framing.metresAhead),
      convertToPixels(floorHeight) - ((FRAMING.floorFromTop - 0.5) * camera.height) / zoom,
    );
  };
}

/**
 * The zoom at which `camera` shows the level while nothing pulls it back: the view is
 * `FRAMING.stickMenTall` stick men tall, or shows `FRAMING.leastMetresAcross` across when the
 * window is too narrow for that. The HUD is always drawn at this zoom, so its lines are as heavy as
 * the level's and it keeps its size when the level's view pulls back.
 */
export function getZoomAtRest(camera: Phaser.Cameras.Scene2D.Camera): number {
  return Math.min(
    camera.height / convertToPixels(FRAMING.stickMenTall * STICK_MAN_HEIGHT),
    camera.width / convertToPixels(FRAMING.leastMetresAcross),
  );
}

/**
 * Where the view wants to be for the stick man as it is now. Centred on the stick man and as wide
 * as it is at rest, unless the stick man is looking where the stick man is going: then the stick
 * man stands to one side, and it is as much wider as it takes to show the next floor line.
 */
function getFramingWanted(input: {
  stickMan: Followed;
  floor: readonly FloorSegment[];
  metresAcrossAtRest: number;
}): Framing {
  const { feet, facing, action, isCarrying } = input.stickMan;
  const isLookingAhead =
    isCarrying ||
    action === 'seated' ||
    (action !== 'jumping' && isAtEdge({ x: feet.x, facing, floor: input.floor }));
  if (!isLookingAhead) {
    return { metresAhead: 0, metresAcross: input.metresAcrossAtRest };
  }
  const distanceToNextLine = measureDistanceToNextLine({ x: feet.x, facing, floor: input.floor });
  const metresToShowNextLine =
    distanceToNextLine === undefined
      ? 0
      : (distanceToNextLine + FRAMING.nextLineMargin) / (1 - FRAMING.trailingViewShare);
  const metresAcross = Math.max(
    input.metresAcrossAtRest,
    Math.min(metresToShowNextLine, FRAMING.mostMetresAcross),
  );
  return { metresAhead: facing * (0.5 - FRAMING.trailingViewShare) * metresAcross, metresAcross };
}

/**
 * `from` a frame of `seconds` closer to `to`: most of the way there after `FRAMING.easeSeconds`,
 * never past it.
 */
function easeTowards(start: Framing, end: Framing, seconds: number): Framing {
  const share = 1 - Math.exp(-Math.max(0, seconds) / FRAMING.easeSeconds);
  return {
    metresAhead: start.metresAhead + (end.metresAhead - start.metresAhead) * share,
    metresAcross: start.metresAcross + (end.metresAcross - start.metresAcross) * share,
  };
}

/**
 * Where along the line the view follows the stick man to, a frame of `seconds` after it was at
 * `followedX`: where the stick man's feet are, unless they got there faster than
 * `FRAMING.fastestFollow`, which only a hop within one tick does.
 */
function keepUpWith(input: { followedX: number; feetX: number; seconds: number }): number {
  const furthest = FRAMING.fastestFollow * Math.max(0, input.seconds);
  return input.followedX + Math.max(-furthest, Math.min(furthest, input.feetX - input.followedX));
}

// ---- Helpers ----

function getMetresAcrossAtRest(camera: Phaser.Cameras.Scene2D.Camera): number {
  return camera.width / getZoomAtRest(camera) / convertToPixels(1);
}

interface Viewpoint {
  readonly x: number;
  readonly facing: 1 | -1;
  readonly floor: readonly FloorSegment[];
}

/**
 * True when the end of the floor line under `x` that the stick man faces is near, and there is
 * floor further on to get to.
 */
function isAtEdge(viewpoint: Viewpoint): boolean {
  const line = viewpoint.floor.find(
    (segment) => segment.start.x <= viewpoint.x && viewpoint.x <= segment.end.x,
  );
  if (!line) {
    return false;
  }
  const distanceToEnd =
    viewpoint.facing === 1 ? line.end.x - viewpoint.x : viewpoint.x - line.start.x;
  return (
    distanceToEnd <= FRAMING.edgeDistance &&
    measureDistanceToNextLine({
      x: viewpoint.x,
      facing: viewpoint.facing,
      floor: viewpoint.floor,
    }) !== undefined
  );
}

/**
 * How far the way the stick man faces the nearest floor line begins that it is not on or over, or
 * undefined when there is none.
 */
function measureDistanceToNextLine(viewpoint: Viewpoint): number | undefined {
  const distances = viewpoint.floor
    .map((segment) =>
      viewpoint.facing === 1 ? segment.start.x - viewpoint.x : viewpoint.x - segment.end.x,
    )
    .filter((distance) => distance > 0);
  return distances.length === 0 ? undefined : Math.min(...distances);
}

export const __testing__ = { FRAMING, getFramingWanted, easeTowards, keepUpWith };
