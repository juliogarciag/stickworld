/**
 * A level is data: the floor, where the stick man starts, and what is placed
 * on the floor. Metres, y pointing down, origin at the start of the level's
 * floor, so the floor line usually sits at y = 0.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * One stretch of pencil line the stick man can stand on. A gap is the space between two segments.
 */
export interface FloorSegment {
  readonly start: Point;
  readonly end: Point;
}

/** Something placed in the level at start, by def id (a flag, a letter). */
export interface Placement {
  readonly defId: number;
  readonly position: Point;
}

/**
 * Something written on the sheet for the player: what to do here, or what this is. Where it is and
 * what it says are the level's; how it is drawn, and the keys drawn beside it, are the view's.
 */
export interface Note {
  /** The middle of the line its words stand on, in metres. */
  readonly position: Point;
  /**
   * What it says. It never names a key: which keys there are is the client's business, and it draws
   * them by what the note is `about`.
   */
  readonly words: string;
  /**
   * What the stick man does that the note is about, when it is about something the stick man does.
   */
  readonly topic?: 'walking' | 'jumping';
  /** True for a note that is a title, the name of something, and not something to do. */
  readonly isTitle?: boolean;
  /**
   * It is rubbed out once the stick man stands on the floor further right than this x: the stick
   * man has done what it says. Left out, it stays.
   */
  readonly rubbedOutPast?: number;
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
  /**
   * The def id of the item the stick man is given when it reaches this level's flag (level 2's
   * paper). Most levels give none.
   */
  readonly flagGivesItem?: number;
  /** What is written on the sheet for the player. Most levels have none. */
  readonly notes?: readonly Note[];
  /**
   * Where the level's checkpoint stands on the floor, if the level has one. After a death the level
   * restarts here, once the stick man has stood on the floor at or past this point (the
   * `checkpoint` feature).
   */
  readonly checkpoint?: Point;
}
