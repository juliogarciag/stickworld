/**
 * How the pencil behaves, in world pixels and seconds. View detail only: none
 * of it reaches the sim. Change the look of every line in the game here.
 */
export const PENCIL = {
  /** Graphite, not black. */
  colour: '#3b3a38',
  /** The thickness callers use unless a line is meant to stand out. */
  thickness: 4.5,
  /** How far apart the points of a drawn path are. */
  pointSpacing: 6,
  /** How far the line strays from the exact path. */
  wobble: 1.3,
  /** The length over which the line strays one way and comes back. */
  wobbleLength: 46,
  /** How many times a second a line is redrawn a little differently. Hand animation "on threes" is 8. */
  boilsPerSecond: 8,
  /** Pressure where the pencil touches down and lifts, against 1 in the middle of a line. */
  pressureAtEnds: 0.55,
  /** The length over which the pencil reaches full pressure. */
  taperLength: 14,
  /** How much the pressure varies along a line, as a share of full pressure. */
  pressureVariation: 0.3,
  /** The length over which the pressure changes. */
  pressureLength: 70,
  /** How far past its start a closed loop goes on. */
  loopOverlap: 9,
  /** The share of a line's pixels where the paper's tooth shows through. */
  toothCoverage: 0.3,
  /** How much of the graphite is missing at such a pixel, at most. */
  toothDepth: 0.85,
  /** How much is missing everywhere else, at most: graphite is never solid. */
  toothHaze: 0.22,
} as const;
