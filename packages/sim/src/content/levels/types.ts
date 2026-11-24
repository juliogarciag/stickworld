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

/**
 * Something written on the sheet for the player: what to do here, or what this is. Where it is and what it says are
 * the level's; how it is drawn, and the keys drawn beside it, are the view's.
 */
export interface Note {
  /** The middle of the line its words stand on, in metres. */
  readonly at: Point;
  /** What it says. It never names a key: which keys there are is the client's business, and it draws them by what the note is `about`. */
  readonly words: string;
  /** What he does that the note is about, when it is about something he does. */
  readonly about?: 'walking' | 'jumping';
  /** True for a note that is a title, the name of something, and not something to do. */
  readonly title?: boolean;
  /** It is rubbed out once he stands on the floor further right than this x: he has done what it says. Left out, it stays. */
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
  /** The def id of the item the stick man is given when he reaches this level's flag (level 2's paper). Most levels give none. */
  readonly flagGivesItem?: number;
  /** What is written on the sheet for the player. Most levels have none. */
  readonly notes?: readonly Note[];
}
