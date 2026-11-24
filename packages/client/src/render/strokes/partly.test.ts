import { describe, expect, it } from 'vitest';
import { dotted, rubbedOutSoFar, writtenSoFar } from './partly';
import type { Stroke } from './stroke';

describe('writtenSoFar', () => {
  it('is nothing at the start and the very same strokes at the end', () => {
    expect(writtenSoFar(TWO_LINES_AND_A_SQUARE, 0)).toEqual([]);
    expect(writtenSoFar(TWO_LINES_AND_A_SQUARE, 1)).toBe(TWO_LINES_AND_A_SQUARE);
    expect(writtenSoFar(TWO_LINES_AND_A_SQUARE, 3)).toBe(TWO_LINES_AND_A_SQUARE);
    expect(writtenSoFar(TWO_LINES_AND_A_SQUARE, -1)).toEqual([]);
  });

  it('writes the strokes one after another, each for as long as it is long, the one being written as far as the pencil has come', () => {
    // 10 + 30 + 40 of length: a quarter of the way is the first line and half of the second.
    const quarter = writtenSoFar(TWO_LINES_AND_A_SQUARE, 0.25);
    expect(quarter).toEqual([TWO_LINES_AND_A_SQUARE[0], { points: [{ x: 0, y: 10 }, { x: 10, y: 10 }], thickness: 2 }]);
    // Three quarters: both lines and the first two sides of the square, which is not a loop until the pencil is back.
    const threeQuarters = writtenSoFar(TWO_LINES_AND_A_SQUARE, 0.75);
    expect(threeQuarters.slice(0, 2)).toEqual(TWO_LINES_AND_A_SQUARE.slice(0, 2));
    expect(threeQuarters[2]).toEqual({ points: [{ x: 0, y: 20 }, { x: 10, y: 20 }, { x: 10, y: 30 }], thickness: 3 });
  });

  it('only ever adds: more of it is written at every later moment', () => {
    let lengthBefore = 0;
    for (let share = 0; share <= 1.0001; share += 0.05) {
      const length = writtenSoFar(TWO_LINES_AND_A_SQUARE, share).reduce((sum, stroke) => sum + lengthOf(stroke), 0);
      expect(length).toBeGreaterThanOrEqual(lengthBefore);
      expect(length).toBeCloseTo(Math.min(1, share) * 80, 6);
      lengthBefore = length;
    }
  });
});

describe('rubbedOutSoFar', () => {
  it('is the very same strokes before, and nothing but empty strokes after', () => {
    expect(rubbedOutSoFar(TWO_LINES_AND_A_SQUARE, 0)).toBe(TWO_LINES_AND_A_SQUARE);
    expect(rubbedOutSoFar(TWO_LINES_AND_A_SQUARE, 1).map((stroke) => stroke.points)).toEqual([[], [], []]);
    expect(rubbedOutSoFar(TWO_LINES_AND_A_SQUARE, 2).map((stroke) => stroke.points)).toEqual([[], [], []]);
  });

  it('rubs them out in the order they were written, and keeps every stroke that is left in its place', () => {
    const quarter = rubbedOutSoFar(TWO_LINES_AND_A_SQUARE, 0.25);
    expect(quarter).toHaveLength(3);
    expect(quarter[0]!.points).toEqual([]);
    expect(quarter[1]!.points).toEqual([{ x: 10, y: 10 }, { x: 30, y: 10 }]);
    expect(quarter[2]).toBe(TWO_LINES_AND_A_SQUARE[2]);
  });

  it('together with what is written so far makes the whole: nothing is drawn twice or left out', () => {
    for (const share of [0.1, 0.3, 0.5, 0.9]) {
      const lengths = [...writtenSoFar(TWO_LINES_AND_A_SQUARE, share), ...rubbedOutSoFar(TWO_LINES_AND_A_SQUARE, share)].map(lengthOf);
      expect(lengths.reduce((sum, length) => sum + length, 0)).toBeCloseTo(80, 9);
    }
  });
});

describe('dotted', () => {
  it('is the same paths as short dashes with gaps between them, every dash on the path', () => {
    const dashes = dotted(TWO_LINES_AND_A_SQUARE, { dash: 4, gap: 6 });
    // 10, 30 and 40 long: one dash every 10.
    expect(dashes).toHaveLength(1 + 3 + 4);
    for (const dash of dashes) expect(lengthOf(dash)).toBeCloseTo(4, 9);
    expect(dashes[0]).toEqual({ points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], thickness: 1 });
    expect(dashes[1]).toEqual({ points: [{ x: 0, y: 10 }, { x: 4, y: 10 }], thickness: 2 });
    expect(dashes[2]!.points[0]).toEqual({ x: 10, y: 10 });
    // The square's dashes go round it, and none of them is a loop.
    expect(dashes.slice(4).map((dash) => dash.points[0])).toEqual([{ x: 0, y: 20 }, { x: 10, y: 20 }, { x: 10, y: 30 }, { x: 0, y: 30 }]);
    expect(dashes.some((dash) => dash.closed)).toBe(false);
  });

  it('covers less than the whole, and nothing for no strokes', () => {
    const drawn = dotted(TWO_LINES_AND_A_SQUARE, { dash: 4, gap: 6 }).reduce((sum, dash) => sum + lengthOf(dash), 0);
    expect(drawn).toBeCloseTo(32, 9);
    expect(dotted([], { dash: 4, gap: 6 })).toEqual([]);
  });
});

// ---- Helpers ----

/** A line of length 10, a line of length 30, and a square with sides of 10. */
const TWO_LINES_AND_A_SQUARE: readonly Stroke[] = [
  { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], thickness: 1 },
  { points: [{ x: 0, y: 10 }, { x: 30, y: 10 }], thickness: 2 },
  { points: [{ x: 0, y: 20 }, { x: 10, y: 20 }, { x: 10, y: 30 }, { x: 0, y: 30 }], thickness: 3, closed: true },
];

function lengthOf({ points, closed }: Stroke): number {
  if (points.length === 0) return 0;
  const path = closed ? [...points, points[0]!] : points;
  let length = 0;
  for (let index = 1; index < path.length; index += 1) length += Math.hypot(path[index]!.x - path[index - 1]!.x, path[index]!.y - path[index - 1]!.y);
  return length;
}
