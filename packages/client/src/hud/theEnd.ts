import type { FlagView } from '@stickworld/sim';
import type { Stroke } from '../render/strokes';
import { writtenSoFar } from '../render/strokes/partly';
import { written } from './handwriting';
import type { Rectangle } from './itemSlots';
import { keysAndWords } from './keysAndWords';

/**
 * What the game writes across the sheet once it is over: "THE END", a
 * stroke at a time, and under it the key that plays it again once the sim
 * offers that. That it is over is the sim's: the flag he reached is the one
 * that ends the game (`flagOf`), and so is when playing again is heard
 * (`gameOf`). The words, their size and how fast they are written are
 * decided here.
 */

/** True once the flag that ends the game has been reached and has gone all the way up its stick. */
export function theEndIsWritten(flag: FlagView | undefined): boolean {
  return flag !== undefined && flag.endsTheGame && flag.reached && flag.raised === 1;
}

/** How much of the end's words is written `seconds` after the pencil started on them, from 0 to 1. */
export function shareOfTheEndWritten(seconds: number): number {
  return Math.max(0, Math.min(1, seconds / THE_END.writtenIn));
}

export interface TheEnd {
  /** How much of the words is written so far, from 0 to 1. */
  readonly shareWritten: number;
  /** The name of the key that plays the game again, or null while playing again is not offered. */
  readonly playAgainKey: string | null;
}

/**
 * The strokes that write the end across the upper part of what the HUD camera sees, centred and never wider than the
 * view has room for, with the key that plays again and its words under them.
 */
export function theEndStrokes({ shareWritten, playAgainKey }: TheEnd, seen: Rectangle): Stroke[] {
  const widthOfOne = written(THE_END.words, { at: { x: 0, y: 0 }, letterHeight: 1 }).width;
  const letterHeight = Math.min(THE_END.letterHeight, (seen.width * THE_END.mostOfTheWidth) / widthOfOne);
  const top = seen.y + seen.height * THE_END.fromTheTop;
  const words = written(THE_END.words, { at: { x: seen.x + (seen.width - widthOfOne * letterHeight) / 2, y: top }, letterHeight }).strokes;
  if (playAgainKey === null) return [...writtenSoFar(words, shareWritten)];
  const prompt = { keys: [playAgainKey], words: THE_END.playAgain, sizes: THE_END.prompt };
  const { width } = keysAndWords({ ...prompt, at: { x: 0, y: 0 } });
  return [...writtenSoFar(words, shareWritten), ...keysAndWords({ ...prompt, at: { x: seen.x + (seen.width - width) / 2, y: top + letterHeight + THE_END.aboveThePrompt } }).strokes];
}

// ---- Helpers ----

/** Sizes in the HUD camera's world pixels, and seconds. */
const THE_END = {
  /** The HUD's own words: no def has them. */
  words: 'the end',
  playAgain: 'play again',
  /** How tall the capitals are where the view is wide enough for that. */
  letterHeight: 150,
  /** The most of the view's width the words take. */
  mostOfTheWidth: 0.7,
  /** Where the top of the words is, as a share of the view's height from the top. */
  fromTheTop: 0.2,
  /** How long writing the words takes. */
  writtenIn: 1.1,
  /** From the foot of the words to the top of the key that plays again. */
  aboveThePrompt: 70,
  prompt: { keySide: 66, insideTheKey: 16, letterHeight: 32, besideTheKey: 26 },
} as const;

export const __testing__ = { THE_END };
