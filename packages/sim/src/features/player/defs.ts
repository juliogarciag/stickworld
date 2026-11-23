/**
 * How the stick man moves. Game feel lives here: change a number, never the
 * logic. Metres and seconds, y pointing down.
 */
export const PLAYER = {
  /** How fast he walks, on the floor and in the air. */
  walkSpeed: 2.2,
  /** How high his feet get in a jump. A small jump: well under his own height. */
  jumpHeight: 0.7,
  /** How fast he falls faster, in metres per second squared. */
  gravity: 22,
  /** Forgiveness: a jump asked for this long before he lands still happens when he does. */
  jumpAskedEarlyWindow: 0.1,
  /** Forgiveness: a jump asked for this long after he walked off an edge still happens. */
  jumpAskedLateWindow: 0.1,
  /** How far below the level's lowest floor he falls before the level starts again. */
  fallBelowFloor: 6,
} as const;
