/**
 * The paper airplane once it is out of his slot and in the world: its size
 * and how it is put down, lifted, carried and lost. Metres and seconds, y
 * pointing down. Game feel lives here: change a number, never the logic.
 * The item he holds before placing it is `AIRPLANE_ITEM_ID` (inventory).
 */
export const AIRPLANE = {
  /** From nose to tail. Big enough to sit on. */
  length: 1.4,
  /** From its underside to the top of its tail. */
  height: 0.34,
  /** How far in front of his feet its middle is when he puts it down. */
  putDownAhead: 0.9,
  /** How far from its middle his feet can be and still lift it. */
  reach: 1.1,
  /** How far above his head its underside is while he carries it. */
  carriedAbove: 0.02,
  /** Put down with its middle up to this far past the end of a floor line, it is pulled back to sit on the edge. Further out it falls. */
  savedPastTheEdge: 0.35,
  /** How far back from the end of the line its middle sits once it has been pulled back. */
  sitsBackFromTheEdge: 0.1,
  /** How fast it falls faster, in metres per second squared. Paper: much slower than he does. */
  gravity: 7,
} as const;

/**
 * How he gets on an airplane that sits on an edge. Boarding itself is issue #5; the key scheme is decided here (ADR 0003).
 */
export const BOARDING = {
  /**
   * false: interacting with an airplane that sits on an edge boards it, and anywhere else lifts it. One press, and the
   * airplane cannot be lifted off an edge.
   * true: a short press always lifts it and a held press boards it. Try this one by changing it here: the keys follow.
   */
  needsAHeldPress: false,
  /** How long a press has to last to count as held, in seconds. Only read when a held press is needed. */
  heldPressSeconds: 0.35,
} as const;
