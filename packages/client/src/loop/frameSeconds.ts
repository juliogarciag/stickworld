/**
 * The most real time one frame counts for. A frame that took longer (the one the paper is made in, a hitch, a tab that
 * comes back) gives the game this much and the rest is dropped. It is the only cap there is: Phaser hands every
 * frame's time over as it was (`fps.smoothStep` is off in `main.ts`).
 */
export const MAX_FRAME_SECONDS = 0.25;

/**
 * The seconds of real time the frame Phaser says took `deltaMs` counts for, for the sim and for the view's own clocks
 * alike: all of it, up to `MAX_FRAME_SECONDS`. What is written on a sheet over its first seconds would otherwise be
 * over before a long first frame was drawn.
 */
export function frameSeconds(deltaMs: number): number {
  return Math.min(Math.max(deltaMs / 1000, 0), MAX_FRAME_SECONDS);
}
