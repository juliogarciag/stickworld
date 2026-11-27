/** Global tuning values. Feature-specific numbers belong to that feature's defs.ts. */

/** Simulation ticks per second. The sim never runs at any other rate. */
export const TICK_RATE = 60;

/** Length of one tick in seconds. */
export const FIXED_DT = 1 / TICK_RATE;

/** The stick man's height in metres. Everything else in the world is sized against it. */
export const STICK_MAN_HEIGHT = 1.8;

/**
 * How wide the stick man is at its widest, in metres: the stick man's head, with room for the pencil and for how it holds itself.
 * The end of a floor line the stick man drops past is kept this far apart from the middle of the stick man, half to each side, and the
 * view draws the stick man inside it.
 */
export const STICK_MAN_WIDTH = 0.65;
