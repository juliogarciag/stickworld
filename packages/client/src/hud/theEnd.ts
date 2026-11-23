import type { FlagView } from '@stickworld/sim';
import type { Stroke } from '../render/strokes';
import { written } from './handwriting';
import type { Rectangle } from './itemSlots';

/**
 * What the game writes across the sheet once it is over. That it is over is
 * the sim's: the flag he reached is the one that ends the game (`flagOf`).
 * The words, and that they wait for the flag to be up, are decided here.
 */

/** True once the flag that ends the game has been reached and has gone all the way up its stick. */
export function theEndIsWritten(flag: FlagView | undefined): boolean {
  return flag !== undefined && flag.endsTheGame && flag.reached && flag.raised === 1;
}

/** The strokes that write the end across the upper part of what the HUD camera sees, centred. */
export function theEndStrokes(seen: Rectangle): Stroke[] {
  const size = written(THE_END.words, { at: { x: 0, y: 0 }, letterHeight: THE_END.letterHeight });
  const at = { x: seen.x + (seen.width - size.width) / 2, y: seen.y + seen.height * THE_END.fromTheTop };
  return written(THE_END.words, { at, letterHeight: THE_END.letterHeight }).strokes;
}

// ---- Helpers ----

/** Sizes in the HUD camera's world pixels, which are the level's. */
const THE_END = {
  /** The HUD's own words: no def has them. */
  words: 'the end',
  letterHeight: 150,
  /** Where the top of the words is, as a share of the view's height from the top. */
  fromTheTop: 0.2,
} as const;
