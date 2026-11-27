import type { Level } from '@stickworld/sim';
import { buildWriting } from '../hud/handwriting';
import type { WorldRectangle } from './cameraView';
import type { Stroke } from './strokes';
import { getRubbedOutSoFar, getWrittenSoFar } from './strokes/partly';
import { convertToPixels } from './units';

/**
 * What every sheet has written on it besides its level: the level's number
 * and name at the top for its first seconds, and a page number in a corner
 * for as long as the level lasts. The number and the name are the level's
 * data; where and how they are written, and for how long, is decided here.
 */

/**
 * The level's number and name, "2. A GAP", above where the stick man starts, in world pixels:
 * written stroke by stroke as the sheet arrives, left for a few seconds and then rubbed out.
 * `secondsOnSheet` is how long this sheet has been the one being played.
 */
export function buildLevelNameStrokes(level: Level, secondsOnSheet: number): readonly Stroke[] {
  const nameState = getLevelNameState(secondsOnSheet);
  const isNameOnSheet = nameState !== 'notYet' && nameState !== 'gone';
  if (!isNameOnSheet) {
    return NOTHING;
  }
  const words = `${level.id}. ${level.name}`;
  const { width } = buildWriting(words, {
    position: { x: 0, y: 0 },
    letterHeight: LEVEL_NAME.letterHeight,
  });
  const { strokes } = buildWriting(words, {
    position: {
      x: convertToPixels(level.start.x) - width / 2,
      y: convertToPixels(level.start.y) - LEVEL_NAME.heightAboveFloor,
    },
    letterHeight: LEVEL_NAME.letterHeight,
  });
  const soFar = getWrittenSoFar(
    strokes,
    (secondsOnSheet - LEVEL_NAME.writtenAfter) / LEVEL_NAME.writtenIn,
  );
  return getRubbedOutSoFar(
    soFar,
    (secondsOnSheet - LEVEL_NAME.rubbedOutAfter) / LEVEL_NAME.rubbedOutIn,
  );
}

/**
 * How far along the level's name is on a sheet that has been on top for `secondsOnTheSheet`. While
 * it is `'notYet'`, `'written'` or `'gone'` it is drawn the same from frame to frame; while it is
 * being written or rubbed out it is not.
 */
export function getLevelNameState(
  secondsOnSheet: number,
): 'notYet' | 'beingWritten' | 'written' | 'beingRubbedOut' | 'gone' {
  if (secondsOnSheet < LEVEL_NAME.writtenAfter) {
    return 'notYet';
  }
  if (secondsOnSheet < LEVEL_NAME.writtenAfter + LEVEL_NAME.writtenIn) {
    return 'beingWritten';
  }
  if (secondsOnSheet < LEVEL_NAME.rubbedOutAfter) {
    return 'written';
  }
  return secondsOnSheet < LEVEL_NAME.rubbedOutAfter + LEVEL_NAME.rubbedOutIn
    ? 'beingRubbedOut'
    : 'gone';
}

/**
 * The page number in the bottom right corner of what the level's camera sees, in world pixels. It
 * is as big on the screen however far the camera has pulled back: `seen.zoom` against `zoomAtRest`
 * says how much bigger to write it.
 */
export function buildPageNumberStrokes(input: {
  page: number;
  seen: WorldRectangle;
  zoomAtRest: number;
}): Stroke[] {
  const timesLarger = input.zoomAtRest / input.seen.zoom;
  const letterHeight = PAGE_NUMBER.letterHeight * timesLarger;
  const { width } = buildWriting(String(input.page), { position: { x: 0, y: 0 }, letterHeight });
  const position = {
    x: input.seen.x + input.seen.width - PAGE_NUMBER.margin * timesLarger - width,
    y: input.seen.y + input.seen.height - PAGE_NUMBER.margin * timesLarger - letterHeight,
  };
  return buildWriting(String(input.page), { position, letterHeight }).strokes;
}

// ---- Helpers ----

const NOTHING: readonly Stroke[] = [];

/** World pixels and seconds. View detail only. */
const LEVEL_NAME = {
  letterHeight: convertToPixels(0.4),
  /** From the floor the stick man starts on up to the top of the words. */
  heightAboveFloor: convertToPixels(4.3),
  /** It is written once the sheet before has been turned away, and takes this long. */
  writtenAfter: 0.55,
  writtenIn: 0.7,
  rubbedOutAfter: 4.6,
  rubbedOutIn: 0.5,
} as const;

/**
 * Sizes on the screen at rest, in the HUD's pixels: the page number is as far from its corner as
 * the item slots are from theirs.
 */
const PAGE_NUMBER = { letterHeight: 46, margin: 56 } as const;

export const __testing__ = { LEVEL_NAME, PAGE_NUMBER };
