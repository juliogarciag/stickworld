import type { Level } from '@stickworld/sim';
import { written } from '../hud/handwriting';
import type { WorldRectangle } from './cameraView';
import type { Stroke } from './strokes';
import { rubbedOutSoFar, writtenSoFar } from './strokes/partly';
import { toPixels } from './units';

/**
 * What every sheet has written on it besides its level: the level's number
 * and name at the top for its first seconds, and a page number in a corner
 * for as long as the level lasts. The number and the name are the level's
 * data; where and how they are written, and for how long, is decided here.
 */

/**
 * The level's number and name, "2. A GAP", above where he starts, in world pixels: written stroke by stroke as the
 * sheet arrives, left for a few seconds and then rubbed out. `secondsOnTheSheet` is how long this sheet has been the
 * one being played.
 */
export function levelNameStrokes(level: Level, secondsOnTheSheet: number): readonly Stroke[] {
  if (secondsOnTheSheet >= LEVEL_NAME.rubbedOutAfter + LEVEL_NAME.rubbedOutIn) return NOTHING;
  const words = `${level.id}. ${level.name}`;
  const { width } = written(words, { at: { x: 0, y: 0 }, letterHeight: LEVEL_NAME.letterHeight });
  const { strokes } = written(words, { at: { x: toPixels(level.start.x) - width / 2, y: toPixels(level.start.y) - LEVEL_NAME.aboveTheFloor }, letterHeight: LEVEL_NAME.letterHeight });
  const soFar = writtenSoFar(strokes, (secondsOnTheSheet - LEVEL_NAME.writtenAfter) / LEVEL_NAME.writtenIn);
  return rubbedOutSoFar(soFar, (secondsOnTheSheet - LEVEL_NAME.rubbedOutAfter) / LEVEL_NAME.rubbedOutIn);
}

/** True while the level's name is drawn the same from frame to frame: all of it written and none of it being rubbed out, or gone. */
export function levelNameIsStill(secondsOnTheSheet: number): boolean {
  const written = secondsOnTheSheet >= LEVEL_NAME.writtenAfter + LEVEL_NAME.writtenIn && secondsOnTheSheet < LEVEL_NAME.rubbedOutAfter;
  return written || secondsOnTheSheet >= LEVEL_NAME.rubbedOutAfter + LEVEL_NAME.rubbedOutIn;
}

/**
 * The page number in the bottom right corner of what the level's camera sees, in world pixels. It is as big on the
 * screen however far the camera has pulled back: `seen.zoom` against `zoomAtRest` says how much bigger to write it.
 */
export function pageNumberStrokes({ page, seen, zoomAtRest }: { page: number; seen: WorldRectangle; zoomAtRest: number }): Stroke[] {
  const larger = zoomAtRest / seen.zoom;
  const letterHeight = PAGE_NUMBER.letterHeight * larger;
  const { width } = written(String(page), { at: { x: 0, y: 0 }, letterHeight });
  const at = { x: seen.x + seen.width - PAGE_NUMBER.margin * larger - width, y: seen.y + seen.height - PAGE_NUMBER.margin * larger - letterHeight };
  return written(String(page), { at, letterHeight }).strokes;
}

// ---- Helpers ----

const NOTHING: readonly Stroke[] = [];

/** World pixels and seconds. View detail only. */
const LEVEL_NAME = {
  letterHeight: toPixels(0.4),
  /** From the floor he starts on up to the top of the words. */
  aboveTheFloor: toPixels(4.3),
  /** It is written once the sheet before has been turned away, and takes this long. */
  writtenAfter: 0.55,
  writtenIn: 0.7,
  rubbedOutAfter: 4.6,
  rubbedOutIn: 0.5,
} as const;

/** Sizes on the screen at rest, in the HUD's pixels: the page number is as far from its corner as the item slots are from theirs. */
const PAGE_NUMBER = { letterHeight: 34, margin: 56 } as const;

export const __testing__ = { LEVEL_NAME, PAGE_NUMBER };
