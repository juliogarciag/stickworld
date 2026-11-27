/**
 * The most real time one frame counts for. A frame that took longer (the one the paper is made in,
 * a hitch) gives the game this much and the rest is dropped. It is the only cap there is: Phaser
 * hands every frame's time over as it was (`fps.smoothStep` is off in `main.ts`), and only starts
 * counting again when the tab is shown or the window focused, so the time a tab was hidden never
 * arrives.
 */
export const MAX_FRAME_SECONDS = 0.25;

/**
 * The seconds of real time the frame Phaser says took `deltaMs` counts for, for the sim and for the
 * view's own clocks alike: all of it, up to `MAX_FRAME_SECONDS`. What is written on a sheet over
 * its first seconds would otherwise be over within the one long frame that follows the making of
 * the paper.
 */
export function getFrameSeconds(deltaMs: number): number {
  return Math.min(Math.max(deltaMs / 1000, 0), MAX_FRAME_SECONDS);
}
