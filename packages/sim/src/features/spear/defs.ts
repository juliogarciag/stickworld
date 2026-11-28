/**
 * The spear in the stick man's hand, and the thrust it makes with it. The item itself is
 * `SPEAR_ITEM_ID` (inventory), made of the paper by a recipe (crafting). Metres and seconds.
 * Change a number, never the logic.
 *
 * The numbers are tuned against the club enemy's (`features/enemy/clubEnemy/defs.ts`), and
 * `spear.test.ts` holds what they must add up to: a thrust reaches an enemy from further away than
 * its club reaches the stick man (`SPEAR_OUTREACHES_CLUB_BY`), and a thrust that misses leaves the
 * stick man without one for long enough to matter (`recoverSeconds`).
 */
export const SPEAR = {
  /** From its butt to its point: nearly as long as the stick man is tall. */
  length: 1.7,
  /** How thick its shaft is. */
  thickness: 0.08,
  /** How high above the stick man's feet a thrust goes: the height of its chest. */
  thrustHeight: 1.05,
  /**
   * How far in front of the stick man's middle the point is as a thrust begins, drawn back, and as
   * it ends, all the way out. The second is how far the spear reaches: further than the club.
   */
  reachDrawnBack: 1.3,
  reach: 2.1,
  /** How long the point takes to go all the way out: the only time the spear hurts. */
  thrustSeconds: 0.1,
  /**
   * How long the stick man takes to draw the spear back afterwards, during which it cannot thrust
   * again: what a thrust that misses costs.
   */
  recoverSeconds: 0.5,
} as const;
