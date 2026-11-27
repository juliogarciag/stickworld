import type { FlagView } from '@stickworld/sim';
import type { Stroke } from '../render/strokes';
import { getWrittenSoFar } from '../render/strokes/partly';
import { buildWriting } from './handwriting';
import type { Rectangle } from './itemSlots';
import { buildKeysAndWords } from './keysAndWords';

/**
 * What the game writes across the sheet once it is over: "THE END", a
 * stroke at a time, and under it the key that plays it again once the sim
 * offers that. That it is over is the sim's: the flag he reached is the one
 * that ends the game (`getFlag`), and so is when playing again is heard
 * (`getGame`). The words, their size and how fast they are written are
 * decided here.
 */

/** True once the flag that ends the game has been reached and has gone all the way up its stick: from then on the end is on the sheet, as much of it as is written so far. */
export function isEndScreenShown(flag: FlagView | undefined): boolean {
  return flag !== undefined && flag.isFinalFlag && flag.isReached && flag.raised === 1;
}

/** How much of the end's words is written `seconds` after the pencil started on them, from 0 to 1. */
export function getEndScreenProgress(seconds: number): number {
  return Math.max(0, Math.min(1, seconds / END_SCREEN.writtenIn));
}

export interface EndScreen {
  /** How much of the words is written so far, from 0 to 1. */
  readonly shareWritten: number;
  /** The name of the key that plays the game again, or null while playing again is not offered. */
  readonly playAgainKey: string | null;
}

/**
 * The strokes that write the end across the upper part of what the HUD camera sees, centred and never wider than the
 * view has room for, with the key that plays again and its words under them.
 */
export function buildEndScreenStrokes(endScreen: EndScreen, seen: Rectangle): Stroke[] {
  const widthOfOne = buildWriting(END_SCREEN.words, { position: { x: 0, y: 0 }, letterHeight: 1 }).width;
  const letterHeight = Math.min(END_SCREEN.letterHeight, (seen.width * END_SCREEN.maxWidthShare) / widthOfOne);
  const top = seen.y + seen.height * END_SCREEN.topMargin;
  const words = buildWriting(END_SCREEN.words, { position: { x: seen.x + (seen.width - widthOfOne * letterHeight) / 2, y: top }, letterHeight }).strokes;
  if (endScreen.playAgainKey === null) return [...getWrittenSoFar(words, endScreen.shareWritten)];
  const prompt = { keys: [endScreen.playAgainKey], words: END_SCREEN.playAgain, sizes: END_SCREEN.prompt };
  const { width } = buildKeysAndWords({ ...prompt, position: { x: 0, y: 0 } });
  return [...getWrittenSoFar(words, endScreen.shareWritten), ...buildKeysAndWords({ ...prompt, position: { x: seen.x + (seen.width - width) / 2, y: top + letterHeight + END_SCREEN.promptGap } }).strokes];
}

// ---- Helpers ----

/** Sizes in the HUD camera's world pixels, and seconds. */
const END_SCREEN = {
  /** The HUD's own words: no def has them. */
  words: 'the end',
  playAgain: 'play again',
  /** How tall the capitals are where the view is wide enough for that. */
  letterHeight: 150,
  /** The most of the view's width the words take. */
  maxWidthShare: 0.7,
  /** Where the top of the words is, as a share of the view's height from the top. */
  topMargin: 0.2,
  /** How long writing the words takes. */
  writtenIn: 1.1,
  /** From the foot of the words to the top of the key that plays again. */
  promptGap: 70,
  prompt: { keySide: 66, keyPadding: 16, letterHeight: 32, keyGap: 26 },
} as const;

export const __testing__ = { END_SCREEN };
