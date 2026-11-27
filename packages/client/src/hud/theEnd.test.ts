import { describe, expect, it } from 'vitest';
import { buildWriting } from './handwriting';
import { buildKeysAndWords } from './keysAndWords';
import {
  __testing__,
  getEndScreenProgress,
  isEndScreenShown,
  buildEndScreenStrokes,
} from './theEnd';

describe('the end', () => {
  it('is only once the flag that ends the game has been reached and is all the way up', () => {
    expect(isEndScreenShown(undefined)).toBe(false);
    expect(isEndScreenShown({ ...LAST_FLAG, isReached: false, raised: 0 })).toBe(false);
    expect(isEndScreenShown({ ...LAST_FLAG, raised: 0.5 })).toBe(false);
    expect(isEndScreenShown({ ...LAST_FLAG, isFinalFlag: false })).toBe(false);
    expect(isEndScreenShown(LAST_FLAG)).toBe(true);
  });

  it('is written large across the upper half of what the camera sees, centred', () => {
    const { xs, ys } = getExtent(buildEndScreenStrokes(ALL_WRITTEN, CAMERA_SEES));
    expect(Math.min(...xs)).toBeGreaterThan(CAMERA_SEES.x);
    expect(Math.max(...xs)).toBeLessThan(CAMERA_SEES.x + CAMERA_SEES.width);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(
      CAMERA_SEES.x + CAMERA_SEES.width / 2,
      6,
    );
    expect(Math.min(...ys)).toBeGreaterThan(CAMERA_SEES.y);
    expect(Math.max(...ys)).toBeLessThan(CAMERA_SEES.y + CAMERA_SEES.height / 2);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(CAMERA_SEES.width / 4);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(END_SCREEN.letterHeight, 6);
  });

  it('fits a narrow view: the words are made smaller, and stay inside it with room on both sides', () => {
    for (const width of NARROW_VIEWS) {
      const seen = { ...CAMERA_SEES, width };
      const { xs, ys } = getExtent(buildEndScreenStrokes(ALL_WRITTEN, seen));
      expect(Math.min(...xs), `${width} wide`).toBeGreaterThan(seen.x + width * 0.1);
      expect(Math.max(...xs), `${width} wide`).toBeLessThan(seen.x + width * 0.9);
      expect(Math.max(...ys) - Math.min(...ys), `${width} wide`).toBeLessThan(
        END_SCREEN.letterHeight,
      );
    }
  });

  it('is written a stroke at a time: more of it at every later moment, all of it after its time', () => {
    const whole = buildEndScreenStrokes(ALL_WRITTEN, CAMERA_SEES);
    let pointsBefore = -1;
    for (let seconds = 0; seconds < END_SCREEN.writtenIn; seconds += END_SCREEN.writtenIn / 12) {
      const strokes = buildEndScreenStrokes(
        { shareWritten: getEndScreenProgress(seconds), playAgainKey: null },
        CAMERA_SEES,
      );
      expect(strokes.length).toBeLessThanOrEqual(whole.length);
      // Every stroke that is there so far starts where the finished one does.
      strokes.forEach((stroke, index) => expect(stroke.points[0]).toEqual(whole[index]!.points[0]));
      const points = strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
      expect(points).toBeGreaterThanOrEqual(pointsBefore);
      pointsBefore = points;
    }
    expect(
      buildEndScreenStrokes(
        { shareWritten: getEndScreenProgress(0), playAgainKey: null },
        CAMERA_SEES,
      ),
    ).toEqual([]);
    expect(
      buildEndScreenStrokes(
        { shareWritten: getEndScreenProgress(END_SCREEN.writtenIn + 5), playAgainKey: null },
        CAMERA_SEES,
      ),
    ).toEqual(whole);
  });

  it('has the key that plays again under it, in a box with its words, centred, once that is offered', () => {
    const withoutPrompt = buildEndScreenStrokes(ALL_WRITTEN, CAMERA_SEES);
    const withKey = buildEndScreenStrokes({ shareWritten: 1, playAgainKey: 'ENTER' }, CAMERA_SEES);
    const prompt = withKey.slice(withoutPrompt.length);
    expect(withKey.slice(0, withoutPrompt.length)).toEqual(withoutPrompt);
    const expected = buildKeysAndWords({
      keys: ['ENTER'],
      words: END_SCREEN.playAgain,
      position: { x: 0, y: 0 },
      sizes: END_SCREEN.prompt,
    });
    expect(prompt).toHaveLength(expected.strokes.length);
    expect(prompt).toHaveLength(
      1 +
        buildWriting('ENTER', { position: { x: 0, y: 0 }, letterHeight: 1 }).strokes.length +
        buildWriting('play again', { position: { x: 0, y: 0 }, letterHeight: 1 }).strokes.length,
    );
    const words = getExtent(withoutPrompt);
    const drawn = getExtent(prompt);
    expect(Math.min(...drawn.ys)).toBeGreaterThan(Math.max(...words.ys));
    expect(Math.max(...drawn.ys)).toBeLessThan(CAMERA_SEES.y + CAMERA_SEES.height * 0.6);
    expect((Math.min(...drawn.xs) + Math.max(...drawn.xs)) / 2).toBeCloseTo(
      CAMERA_SEES.x + CAMERA_SEES.width / 2,
      6,
    );
  });
});

// ---- Helpers ----

const { END_SCREEN } = __testing__;
const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const LAST_FLAG = {
  position: { x: 24, y: 0 },
  height: 2.2,
  isReached: true,
  upFor: 1,
  raised: 1,
  isFinalFlag: true,
};
const ALL_WRITTEN = { shareWritten: 1, playAgainKey: null };
/** A portrait window at the zoom the HUD has at rest, and one narrower still. */
const NARROW_VIEWS = [1200, 600];

function getExtent(strokes: readonly { points: readonly { x: number; y: number }[] }[]): {
  xs: number[];
  ys: number[];
} {
  const points = strokes.flatMap((stroke) => stroke.points);
  expect(points.length).toBeGreaterThan(10);
  return { xs: points.map((point) => point.x), ys: points.map((point) => point.y) };
}
