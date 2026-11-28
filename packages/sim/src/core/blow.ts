import type { Point } from '../content/levels/types';

/**
 * How one thing strikes another (ADR 0008). The one that strikes says where what it strikes with
 * is this instant, as a `Blow`; the one that may be struck owns its own outline, tests the blow
 * against it and decides what being struck does to it (`strikePlayerWith` in
 * `features/player/body.ts`). Plain arithmetic, shared so that every feature tests a hit the same
 * way.
 */

/** A box with its sides along the axes, in metres. y points down, so `top` is the smaller y. */
export interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * Where something that strikes is at one instant: a straight line with a thickness (a club, a
 * spear), in metres. A swing is many of these, one after the other.
 */
export interface Blow {
  readonly start: Point;
  readonly end: Point;
  /** How thick it is across, in metres. */
  readonly thickness: number;
  /** Which way it knocks what it strikes: 1 to the right, -1 to the left. */
  readonly direction: 1 | -1;
}

/**
 * True when `blow` touches `box`. Half the blow's thickness is added to the box on every side, so
 * a corner is touched from a hair further than a round end would reach: about a fifth of the
 * thickness at most. The blow reaches half its thickness past each of its ends, too.
 */
export function doesBlowTouchBox(blow: Blow, box: Box): boolean {
  const margin = blow.thickness / 2;
  // The part of the line that is inside the box, as shares of its length: none when it starts
  // after it ends.
  let enterShare = 0;
  let exitShare = 1;
  const axes = [
    { start: blow.start.x, end: blow.end.x, min: box.left - margin, max: box.right + margin },
    { start: blow.start.y, end: blow.end.y, min: box.top - margin, max: box.bottom + margin },
  ];
  for (const axis of axes) {
    const length = axis.end - axis.start;
    if (length === 0) {
      const isOutside = axis.start < axis.min || axis.start > axis.max;
      if (isOutside) {
        return false;
      }
      continue;
    }
    const shareAtMin = (axis.min - axis.start) / length;
    const shareAtMax = (axis.max - axis.start) / length;
    enterShare = Math.max(enterShare, Math.min(shareAtMin, shareAtMax));
    exitShare = Math.min(exitShare, Math.max(shareAtMin, shareAtMax));
  }
  return enterShare <= exitShare;
}
