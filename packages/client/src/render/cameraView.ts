import type Phaser from 'phaser';

/** A rectangle of the world, in world pixels, with how many screen pixels one world pixel covers. */
export interface WorldRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/**
 * The part of the world `camera` shows with its scroll and zoom as they are
 * right now. Phaser's own `worldView` is only updated when the camera
 * renders, so it is one frame behind while a scene updates.
 */
export function getWorldSeenBy(camera: Phaser.Cameras.Scene2D.Camera): WorldRectangle {
  const { zoom } = camera;
  const width = camera.width / zoom;
  const height = camera.height / zoom;
  return {
    x: camera.scrollX + (camera.width - width) / 2,
    y: camera.scrollY + (camera.height - height) / 2,
    width,
    height,
    zoom,
  };
}
