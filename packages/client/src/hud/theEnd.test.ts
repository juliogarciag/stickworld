import { describe, expect, it } from 'vitest';
import { written } from './handwriting';
import { keysAndWords } from './keysAndWords';
import { __testing__, shareOfTheEndWritten, theEndIsWritten, theEndStrokes } from './theEnd';

describe('the end', () => {
  it('is only once the flag that ends the game has been reached and is all the way up', () => {
    expect(theEndIsWritten(undefined)).toBe(false);
    expect(theEndIsWritten({ ...LAST_FLAG, reached: false, raised: 0 })).toBe(false);
    expect(theEndIsWritten({ ...LAST_FLAG, raised: 0.5 })).toBe(false);
    expect(theEndIsWritten({ ...LAST_FLAG, endsTheGame: false })).toBe(false);
    expect(theEndIsWritten(LAST_FLAG)).toBe(true);
  });

  it('is written large across the upper half of what the camera sees, centred', () => {
    const { xs, ys } = extentOf(theEndStrokes(ALL_WRITTEN, CAMERA_SEES));
    expect(Math.min(...xs)).toBeGreaterThan(CAMERA_SEES.x);
    expect(Math.max(...xs)).toBeLessThan(CAMERA_SEES.x + CAMERA_SEES.width);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(CAMERA_SEES.x + CAMERA_SEES.width / 2, 6);
    expect(Math.min(...ys)).toBeGreaterThan(CAMERA_SEES.y);
    expect(Math.max(...ys)).toBeLessThan(CAMERA_SEES.y + CAMERA_SEES.height / 2);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(CAMERA_SEES.width / 4);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(THE_END.letterHeight, 6);
  });

  it.each(NARROW_VIEWS)('fits a view %i wide: the words are made smaller, and stay inside it with room on both sides', (width) => {
    const seen = { ...CAMERA_SEES, width };
    const { xs, ys } = extentOf(theEndStrokes(ALL_WRITTEN, seen));
    expect(Math.min(...xs)).toBeGreaterThan(seen.x + width * 0.1);
    expect(Math.max(...xs)).toBeLessThan(seen.x + width * 0.9);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(THE_END.letterHeight);
  });

  it('is written a stroke at a time: more of it at every later moment, all of it after its time', () => {
    const whole = theEndStrokes(ALL_WRITTEN, CAMERA_SEES);
    let pointsBefore = -1;
    for (let seconds = 0; seconds < THE_END.writtenIn; seconds += THE_END.writtenIn / 12) {
      const strokes = theEndStrokes({ shareWritten: shareOfTheEndWritten(seconds), playAgainKey: null }, CAMERA_SEES);
      expect(strokes.length).toBeLessThanOrEqual(whole.length);
      // Every stroke that is there so far starts where the finished one does.
      strokes.forEach((stroke, index) => expect(stroke.points[0]).toEqual(whole[index]!.points[0]));
      const points = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
      expect(points).toBeGreaterThanOrEqual(pointsBefore);
      pointsBefore = points;
    }
    expect(theEndStrokes({ shareWritten: shareOfTheEndWritten(0), playAgainKey: null }, CAMERA_SEES)).toEqual([]);
    expect(theEndStrokes({ shareWritten: shareOfTheEndWritten(THE_END.writtenIn + 5), playAgainKey: null }, CAMERA_SEES)).toEqual(whole);
  });

  it('has the key that plays again under it, in a box with its words, centred, once that is offered', () => {
    const without = theEndStrokes(ALL_WRITTEN, CAMERA_SEES);
    const withKey = theEndStrokes({ shareWritten: 1, playAgainKey: 'ENTER' }, CAMERA_SEES);
    const prompt = withKey.slice(without.length);
    expect(withKey.slice(0, without.length)).toEqual(without);
    const expected = keysAndWords({ keys: ['ENTER'], words: THE_END.playAgain, at: { x: 0, y: 0 }, sizes: THE_END.prompt });
    expect(prompt).toHaveLength(expected.strokes.length);
    expect(prompt).toHaveLength(1 + written('ENTER', { at: { x: 0, y: 0 }, letterHeight: 1 }).strokes.length + written('play again', { at: { x: 0, y: 0 }, letterHeight: 1 }).strokes.length);
    const words = extentOf(without);
    const drawn = extentOf(prompt);
    expect(Math.min(...drawn.ys)).toBeGreaterThan(Math.max(...words.ys));
    expect(Math.max(...drawn.ys)).toBeLessThan(CAMERA_SEES.y + CAMERA_SEES.height * 0.6);
    expect((Math.min(...drawn.xs) + Math.max(...drawn.xs)) / 2).toBeCloseTo(CAMERA_SEES.x + CAMERA_SEES.width / 2, 6);
  });
});

// ---- Helpers ----

const { THE_END } = __testing__;
const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const LAST_FLAG = { at: { x: 24, y: 0 }, height: 2.2, reached: true, upFor: 1, raised: 1, endsTheGame: true };
const ALL_WRITTEN = { shareWritten: 1, playAgainKey: null };
/** A portrait window at the zoom the HUD has at rest, and one narrower still. */
const NARROW_VIEWS = [1200, 600];

function extentOf(strokes: readonly { points: readonly { x: number; y: number }[] }[]): { xs: number[]; ys: number[] } {
  const points = strokes.flatMap((stroke) => stroke.points);
  expect(points.length).toBeGreaterThan(10);
  return { xs: points.map((point) => point.x), ys: points.map((point) => point.y) };
}
