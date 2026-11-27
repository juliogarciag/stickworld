import { describe, expect, it } from 'vitest';
import { getRubbedOutSoFar, getWrittenSoFar } from './partly';
import type { Stroke } from './stroke';

describe('getWrittenSoFar', () => {
  it('is nothing at the start and the very same strokes at the end', () => {
    expect(getWrittenSoFar(TWO_LINES_AND_A_SQUARE, 0)).toEqual([]);
    expect(getWrittenSoFar(TWO_LINES_AND_A_SQUARE, 1)).toBe(TWO_LINES_AND_A_SQUARE);
    expect(getWrittenSoFar(TWO_LINES_AND_A_SQUARE, 3)).toBe(TWO_LINES_AND_A_SQUARE);
    expect(getWrittenSoFar(TWO_LINES_AND_A_SQUARE, -1)).toEqual([]);
  });

  it('writes the strokes one after another, each for as long as it is long, the one being written as far as the pencil has come', () => {
    // 10 + 30 + 40 of length: a quarter of the way is the first line and half of the second.
    const quarter = getWrittenSoFar(TWO_LINES_AND_A_SQUARE, 0.25);
    expect(quarter).toEqual([TWO_LINES_AND_A_SQUARE[0], { points: [{ x: 0, y: 10 }, { x: 10, y: 10 }], thickness: 2 }]);
    // Three quarters: both lines and the first two sides of the square, which is not a loop until the pencil is back.
    const threeQuarters = getWrittenSoFar(TWO_LINES_AND_A_SQUARE, 0.75);
    expect(threeQuarters.slice(0, 2)).toEqual(TWO_LINES_AND_A_SQUARE.slice(0, 2));
    expect(threeQuarters[2]).toEqual({ points: [{ x: 0, y: 20 }, { x: 10, y: 20 }, { x: 10, y: 30 }], thickness: 3 });
  });

  it('only ever adds: more of it is written at every later moment', () => {
    let lengthBefore = 0;
    for (let share = 0; share <= 1.0001; share += 0.05) {
      const length = getWrittenSoFar(TWO_LINES_AND_A_SQUARE, share).reduce((sum, stroke) => sum + measureLength(stroke), 0);
      expect(length).toBeGreaterThanOrEqual(lengthBefore);
      expect(length).toBeCloseTo(Math.min(1, share) * 80, 6);
      lengthBefore = length;
    }
  });
});

describe('getRubbedOutSoFar', () => {
  it('is the very same strokes before, and nothing but empty strokes after', () => {
    expect(getRubbedOutSoFar(TWO_LINES_AND_A_SQUARE, 0)).toBe(TWO_LINES_AND_A_SQUARE);
    expect(getRubbedOutSoFar(TWO_LINES_AND_A_SQUARE, 1).map((stroke) => stroke.points)).toEqual([[], [], []]);
    expect(getRubbedOutSoFar(TWO_LINES_AND_A_SQUARE, 2).map((stroke) => stroke.points)).toEqual([[], [], []]);
  });

  it('rubs them out in the order they were written, and keeps every stroke that is left in its place', () => {
    const quarter = getRubbedOutSoFar(TWO_LINES_AND_A_SQUARE, 0.25);
    expect(quarter).toHaveLength(3);
    expect(quarter[0]!.points).toEqual([]);
    expect(quarter[1]!.points).toEqual([{ x: 10, y: 10 }, { x: 30, y: 10 }]);
    expect(quarter[2]).toBe(TWO_LINES_AND_A_SQUARE[2]);
  });

  it('together with what is written so far makes the whole: nothing is drawn twice or left out', () => {
    for (const share of [0.1, 0.3, 0.5, 0.9]) {
      const lengths = [...getWrittenSoFar(TWO_LINES_AND_A_SQUARE, share), ...getRubbedOutSoFar(TWO_LINES_AND_A_SQUARE, share)].map(measureLength);
      expect(lengths.reduce((sum, length) => sum + length, 0)).toBeCloseTo(80, 9);
    }
  });
});

// ---- Helpers ----

/** A line of length 10, a line of length 30, and a square with sides of 10. */
const TWO_LINES_AND_A_SQUARE: readonly Stroke[] = [
  { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], thickness: 1 },
  { points: [{ x: 0, y: 10 }, { x: 30, y: 10 }], thickness: 2 },
  { points: [{ x: 0, y: 20 }, { x: 10, y: 20 }, { x: 10, y: 30 }, { x: 0, y: 30 }], thickness: 3, closed: true },
];

function measureLength({ points, closed }: Stroke): number {
  if (points.length === 0) return 0;
  const path = closed ? [...points, points[0]!] : points;
  let length = 0;
  for (let index = 1; index < path.length; index += 1) length += Math.hypot(path[index]!.x - path[index - 1]!.x, path[index]!.y - path[index - 1]!.y);
  return length;
}
