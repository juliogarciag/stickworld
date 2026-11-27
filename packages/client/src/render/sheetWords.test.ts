import { getLevelById } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { buildWriting } from '../hud/handwriting';
import {
  __testing__,
  getLevelNameState,
  buildLevelNameStrokes,
  buildPageNumberStrokes,
} from './sheetWords';
import { convertToPixels } from './units';

describe('the name of a level', () => {
  it('is its number and name, written above where the stick man starts, centred on the stick man', () => {
    const strokes = buildLevelNameStrokes(LEVEL_2, WRITTEN_BY);
    expect(strokes).toHaveLength(
      buildWriting('2. A gap', { position: { x: 0, y: 0 }, letterHeight: 1 }).strokes.length,
    );
    const points = strokes.flatMap((stroke) => stroke.points);
    const xs = points.map((point) => point.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(
      convertToPixels(LEVEL_2.start.x),
      6,
    );
    // Above the stick man's head, with room to spare.
    expect(Math.max(...points.map((point) => point.y))).toBeLessThan(
      convertToPixels(LEVEL_2.start.y - 3),
    );
  });

  it('is not there while the sheet before is turned away, is then written a stroke at a time, stays, and is rubbed out a few seconds later', () => {
    const countPointsAt = (seconds: number): number =>
      buildLevelNameStrokes(LEVEL_2, seconds).reduce(
        (sum, stroke) => sum + stroke.points.length,
        0,
      );
    const whole = countPointsAt(WRITTEN_BY);
    expect(countPointsAt(0)).toBe(0);
    expect(countPointsAt(LEVEL_NAME.writtenAfter)).toBe(0);
    const halfWritten = countPointsAt(LEVEL_NAME.writtenAfter + LEVEL_NAME.writtenIn / 2);
    expect(halfWritten).toBeGreaterThan(0);
    expect(halfWritten).toBeLessThan(whole);
    expect(countPointsAt(LEVEL_NAME.rubbedOutAfter)).toBe(whole);
    expect(LEVEL_NAME.rubbedOutAfter - WRITTEN_BY).toBeGreaterThan(3);
    const halfRubbedOut = countPointsAt(LEVEL_NAME.rubbedOutAfter + LEVEL_NAME.rubbedOutIn / 2);
    expect(halfRubbedOut).toBeGreaterThan(0);
    expect(halfRubbedOut).toBeLessThan(whole);
    expect(countPointsAt(LEVEL_NAME.rubbedOutAfter + LEVEL_NAME.rubbedOutIn)).toBe(0);
    expect(countPointsAt(Infinity)).toBe(0);
  });

  it('says how far along it is, and is the very same strokes from frame to frame once it is gone', () => {
    expect(getLevelNameState(0)).toBe('notYet');
    expect(getLevelNameState(LEVEL_NAME.writtenAfter + LEVEL_NAME.writtenIn / 2)).toBe(
      'beingWritten',
    );
    expect(getLevelNameState(WRITTEN_BY)).toBe('written');
    expect(getLevelNameState(LEVEL_NAME.rubbedOutAfter + LEVEL_NAME.rubbedOutIn / 2)).toBe(
      'beingRubbedOut',
    );
    expect(getLevelNameState(LEVEL_NAME.rubbedOutAfter + LEVEL_NAME.rubbedOutIn)).toBe('gone');
    expect(getLevelNameState(Infinity)).toBe('gone');
    expect(buildLevelNameStrokes(LEVEL_2, Infinity)).toBe(buildLevelNameStrokes(LEVEL_2, 100));
    expect(buildLevelNameStrokes(LEVEL_2, 0)).toBe(buildLevelNameStrokes(LEVEL_2, 100));
  });
});

describe('the page number', () => {
  it('is in the bottom right corner of what the camera sees', () => {
    const points = buildPageNumberStrokes({ page: 3, seen: SEEN, zoomAtRest: SEEN.zoom }).flatMap(
      (stroke) => stroke.points,
    );
    expect(Math.max(...points.map((point) => point.x))).toBeCloseTo(
      SEEN.x + SEEN.width - PAGE_NUMBER.margin,
      6,
    );
    expect(Math.max(...points.map((point) => point.y))).toBeCloseTo(
      SEEN.y + SEEN.height - PAGE_NUMBER.margin,
      6,
    );
    expect(Math.min(...points.map((point) => point.y))).toBeCloseTo(
      SEEN.y + SEEN.height - PAGE_NUMBER.margin - PAGE_NUMBER.letterHeight,
      6,
    );
  });

  it('is as big on the screen when the camera has pulled back: twice as far away it is written twice as large', () => {
    const pulledBack = {
      x: SEEN.x,
      y: SEEN.y,
      width: SEEN.width * 2,
      height: SEEN.height * 2,
      zoom: SEEN.zoom / 2,
    };
    const getPointsOnScreen = (seen: typeof SEEN): { x: number; y: number }[] =>
      buildPageNumberStrokes({ page: 12, seen, zoomAtRest: SEEN.zoom }).flatMap((stroke) =>
        stroke.points.map((point) => ({
          x: (point.x - seen.x) * seen.zoom,
          y: (point.y - seen.y) * seen.zoom,
        })),
      );
    expect(getPointsOnScreen(pulledBack)).toEqual(
      getPointsOnScreen(SEEN).map((point) => ({
        x: expect.closeTo(point.x, 6),
        y: expect.closeTo(point.y, 6),
      })),
    );
  });
});

// ---- Helpers ----

const { LEVEL_NAME, PAGE_NUMBER } = __testing__;
const LEVEL_2 = getLevelById(2);
/** A moment by which all of the name is written. */
const WRITTEN_BY = LEVEL_NAME.writtenAfter + LEVEL_NAME.writtenIn + 0.1;
const SEEN = { x: 40, y: -20, width: 1920, height: 1080, zoom: 0.5 };
