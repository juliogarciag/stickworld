import type { SimHandle } from '@stickworld/sim';

/**
 * The page being turned between two levels: the finished sheet slides away
 * to the left and the next one is under it. View state only: the sim started
 * the next level in one tick, and it is played from that tick on, under the
 * sheet that is leaving. One of these is shared by the scenes that draw the
 * turn.
 */

/** The sheet that is leaving: the sim as it was on the last tick of the finished level, and how the level's camera looked at it. */
export interface FinishedSheet {
  /** Never stepped: it is only read, to draw the level as it was left. */
  readonly sim: SimHandle;
  readonly camera: { readonly scrollX: number; readonly scrollY: number; readonly zoom: number };
}

/** A page turn in progress. */
export interface TurningPage extends FinishedSheet {
  /** Where the right edge of the leaving sheet is, as a share of the view's width from its left side: 1 as the turn starts, 0 or less once it is out of view. */
  readonly edgeAt: number;
}

export interface PageTurn {
  /** Starts turning `finished` away. A turn still in progress is cut short. */
  start(finished: FinishedSheet): void;
  /** Lets `seconds` of the turn pass. */
  advanceBy(seconds: number): void;
  /** The turn in progress, or undefined when no page is being turned. */
  now(): TurningPage | undefined;
}

export function createPageTurn(): PageTurn {
  let turning: { finished: FinishedSheet; seconds: number } | undefined;
  return {
    start(finished) {
      turning = { finished, seconds: 0 };
    },
    advanceBy(seconds) {
      if (!turning) return;
      turning.seconds += seconds;
      if (turning.seconds >= TURN.seconds) turning = undefined;
    },
    now() {
      return turning && { ...turning.finished, edgeAt: edgeAfter(turning.seconds) };
    },
  };
}

// ---- Helpers ----

/** Seconds and shares of the view's width. View detail only. */
const TURN = {
  seconds: 0.9,
  /** How far the sheet has gone by the end: a little more than out of view, so the shadow at its edge leaves too. */
  slidesBy: 1.1,
  /** How much it holds back at first: 1 would slide evenly, more starts slower and ends faster. */
  slowStart: 2.4,
} as const;

/** Where the sheet's right edge is `seconds` into the turn: it starts slowly, as a sheet lifted by a corner does, and is whisked away. */
function edgeAfter(seconds: number): number {
  const share = Math.max(0, Math.min(1, seconds / TURN.seconds));
  return 1 - TURN.slidesBy * share ** TURN.slowStart;
}

export const __testing__ = { TURN, edgeAfter };
