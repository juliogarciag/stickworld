import { STICK_MAN_HEIGHT, type Point } from '@stickworld/sim';
import type Phaser from 'phaser';
import { toPixels } from './units';

/** How the camera frames the level. View detail only. */
const FRAMING = {
  /** How many stick men tall the view is: this, not the pixel ratio, decides how big things are on screen. */
  stickMenTall: 2.6,
  /** Where the floor under him sits, as a share of the view's height from the top. */
  floorFromTop: 0.72,
} as const;

/** Points `camera` at the stick man standing at `feet` (metres), at the zoom that fits the view to its height. */
export function frameStickMan(camera: Phaser.Cameras.Scene2D.Camera, feet: Point): void {
  const viewHeight = toPixels(FRAMING.stickMenTall * STICK_MAN_HEIGHT);
  camera.setZoom(camera.height / viewHeight);
  camera.centerOn(toPixels(feet.x), toPixels(feet.y) - (FRAMING.floorFromTop - 0.5) * viewHeight);
}
