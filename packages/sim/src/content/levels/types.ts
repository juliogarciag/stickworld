/**
 * A level is data: the floor, where the stick man starts, and what is placed
 * on the floor. Metres, y pointing down, origin at the start of the level's
 * floor, so the floor line usually sits at y = 0.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One stretch of pencil line the stick man can stand on. A gap is the space between two segments. */
export interface FloorSegment {
  readonly from: Point;
  readonly to: Point;
}

/** Something placed in the level at start, by def id (a flag, a letter). */
export interface Placement {
  readonly defId: number;
  readonly at: Point;
}

export interface Level {
  /** The level's number, as players and `VITE_LEVEL` count it. Never reused. */
  readonly id: number;
  readonly name: string;
  /** Floor segments from left to right. */
  readonly floor: readonly FloorSegment[];
  /** Where the stick man's feet are when the level starts. */
  readonly start: Point;
  readonly placements: readonly Placement[];
  /** The def id of the item the stick man is given when he reaches this level's flag (level 2's paper). Most levels give none. */
  readonly flagGivesItem?: number;
}
