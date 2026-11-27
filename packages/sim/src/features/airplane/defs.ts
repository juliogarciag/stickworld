/**
 * The paper airplane once it is out of the stick man's slot and in the world: its size
 * and how it is put down, lifted, carried and lost. Metres and seconds, y
 * pointing down. Game feel lives here: change a number, never the logic.
 * The item the stick man holds before placing it is `AIRPLANE_ITEM_ID` (inventory).
 */
export const AIRPLANE = {
  /** From nose to tail. Big enough to sit on. */
  length: 1.4,
  /** From its underside to the top of its tail. */
  height: 0.34,
  /** How far in front of the stick man's feet its middle is when the stick man puts it down. */
  putDownAhead: 0.9,
  /** How far from its middle the stick man's feet can be and still lift it. */
  reach: 1.1,
  /** How far above the stick man's head its underside is while the stick man carries it. */
  carriedAbove: 0.02,
  /**
   * Put down with its middle up to this far past the end of a floor line, it is pulled back to sit
   * on the edge. Further out it falls.
   */
  edgeOverhangTolerance: 0.35,
  /** How far back from the end of the line its middle sits once it has been pulled back. */
  edgeInset: 0.1,
  /**
   * How fast it falls faster, in metres per second squared. Paper: much slower than the stick man
   * does.
   */
  gravity: 7,
} as const;

/**
 * Flying it. The glide is an exchange, not aerodynamics: height is paid for
 * with speed and speed is bought with height, a little is lost all the time,
 * and below the stall speed it stops gliding and falls. Metres, seconds and
 * radians; a pitch is how far the nose points up, negative when it points down.
 */
export const FLIGHT = {
  /** How fast it leaves the edge when the stick man boards it. */
  launchSpeed: 7.5,
  /** Where its nose points as it leaves the edge: a little up, so it clears the line it sat on. */
  launchPitch: 0.2,
  /** How fast a held steer key turns its nose, in radians per second. */
  pitchRate: 1.7,
  /**
   * With no steer key held its nose sinks to `restingPitch`, this fast: left alone it glides gently
   * down.
   */
  noseSinkRate: 1.3,
  /** Where its nose points when nobody steers it: a little down. */
  restingPitch: -0.36,
  /** The furthest up and the furthest down its nose goes. */
  steepestClimb: 0.75,
  steepestDive: -0.75,
  /**
   * The exchange: the speed every metre climbed costs, and the speed every metre dived gives. Less
   * comes back than was paid.
   */
  speedLostPerMetreClimbed: 1.2,
  speedGainedPerMetreDived: 0.8,
  /** The speed it loses every second whatever it does. */
  speedLostPerSecond: 0.5,
  /** Slower than this it no longer glides: it falls, with the stick man in it. */
  stallSpeed: 3,
  /** However far it dives it gets no faster than this. */
  fastestSpeed: 11,
  /**
   * How fast it loses its speed sliding along the floor it came down on, in metres per second
   * squared.
   */
  landingSlowdown: 14,
  /**
   * How far below the level's lowest floor it gets, with the stick man in it, before the level
   * starts again.
   */
  lostBelowFloor: 3,
} as const;
