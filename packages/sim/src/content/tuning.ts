/** Global tuning values. Feature-specific numbers belong to that feature's defs.ts. */

/** Simulation ticks per second. The sim never runs at any other rate. */
export const TICK_RATE = 60;

/** Length of one tick in seconds. */
export const FIXED_DT = 1 / TICK_RATE;

/** The stick man's height in metres. Everything else in the world is sized against it. */
export const STICK_MAN_HEIGHT = 1.8;
