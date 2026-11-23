import { STICK_MAN_HEIGHT, type Point, type StickManView } from '@stickworld/sim';
import type Phaser from 'phaser';
import { toPixels } from './units';

/** How the camera frames the level. View detail only. */
const FRAMING = {
  /** How many stick men tall the view is: this, not the pixel ratio, decides how big things are on screen. */
  stickMenTall: 6,
  /** Where the floor under him sits, as a share of the view's height from the top. */
  floorFromTop: 0.72,
} as const;

/**
 * Returns a function that points `camera` at the stick man, to call every
 * frame. It follows him along the line, and stays at the height of the floor
 * he last stood on while his feet are off it: a jump moves him on the screen,
 * not the paper under him.
 */
export function followStickManWith(camera: Phaser.Cameras.Scene2D.Camera): (stickMan: StickManView) => void {
  let floorHeight: number | undefined;
  return ({ feet, action }) => {
    if (action !== 'jumping' || floorHeight === undefined) floorHeight = feet.y;
    frame(camera, { x: feet.x, y: floorHeight });
  };
}

// ---- Helpers ----

/** Points `camera` at the floor at `floor` (metres), at the zoom that fits the view to its height. */
function frame(camera: Phaser.Cameras.Scene2D.Camera, floor: Point): void {
  const viewHeight = toPixels(FRAMING.stickMenTall * STICK_MAN_HEIGHT);
  camera.setZoom(camera.height / viewHeight);
  camera.centerOn(toPixels(floor.x), toPixels(floor.y) - (FRAMING.floorFromTop - 0.5) * viewHeight);
}
