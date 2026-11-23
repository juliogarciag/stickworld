/**
 * How the stick man moves. Game feel lives here: change a number, never the
 * logic. Metres and seconds, y pointing down.
 */
export const PLAYER = {
  /** How fast he walks. In the air it is the fastest the keys can make him go sideways. */
  walkSpeed: 2.2,
  /**
   * How much the keys steer him in the air: the most his sideways speed changes, in metres per second squared.
   * On the floor he is at walk speed at once; in the air he keeps the speed he left the floor with, and a held
   * key only changes it this fast. With no key held he drifts on as he was.
   */
  airSteering: 6,
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
  /** How wide he is at his widest, head and arms: what the end of a floor line pushes aside as he drops past it. */
  width: 0.5,
  /** How far above his feet he is that wide. Below it he narrows to a point at his feet, which is all that stands on the line. */
  fullWidthAbove: 0.5,
} as const;
