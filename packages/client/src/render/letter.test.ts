import type { FallenItemView, LetterView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { fallenPaperStrokes, letterStrokes } from './letter';
import type { Stroke } from './strokes';
import { PIXELS_PER_METRE } from './units';

describe('letterStrokes', () => {
  it('draws an envelope standing on the floor where the letter lies', () => {
    const strokes = letterStrokes(LETTER);
    expect(strokes[0]).toMatchObject({ closed: true });
    const { left, right, top, bottom } = boundsOf(strokes);
    expect(left).toBeLessThan(LETTER.at.x);
    expect(right).toBeGreaterThan(LETTER.at.x);
    expect(bottom).toBeGreaterThan(LETTER.at.y - 0.01);
    expect(bottom).toBeLessThan(LETTER.at.y + 0.1);
    expect(top).toBeLessThan(LETTER.at.y - 0.2);
  });

  it('is not drawn on the floor while he reads it', () => {
    expect(letterStrokes({ ...LETTER, beingRead: true })).toEqual([]);
  });
});

describe('fallenPaperStrokes', () => {
  it('draws a sheet lying on the floor where it fell: wide, low, and not an envelope', () => {
    const { left, right, top, bottom } = boundsOf(fallenPaperStrokes(LYING));
    expect(left).toBeLessThan(LYING.at.x);
    expect(right).toBeGreaterThan(LYING.at.x);
    expect(bottom).toBeLessThan(LYING.at.y + 0.1);
    expect(right - left).toBeGreaterThan(2 * (bottom - top));
    const envelope = boundsOf(letterStrokes(LETTER));
    expect(bottom - top).toBeLessThan(envelope.bottom - envelope.top);
  });

  it('draws it as high above that as it still is, off to a side as it sways', () => {
    const lying = boundsOf(fallenPaperStrokes(LYING));
    const high = boundsOf(fallenPaperStrokes({ ...LYING, height: 5 }));
    expect(high.bottom).toBeLessThan(lying.bottom - 4);
    const middles = [5, 4.6, 4.2, 3.8, 3.4].map((height) => {
      const { left, right } = boundsOf(fallenPaperStrokes({ ...LYING, height }));
      return (left + right) / 2;
    });
    expect(Math.max(...middles) - Math.min(...middles)).toBeGreaterThan(0.2);
  });

  it('lies still the moment it lands: just above the floor it is where it will lie', () => {
    const lying = boundsOf(fallenPaperStrokes(LYING));
    const landing = boundsOf(fallenPaperStrokes({ ...LYING, height: 0.001 }));
    expect(landing.left).toBeCloseTo(lying.left, 2);
    expect(landing.right).toBeCloseTo(lying.right, 2);
  });
});

// ---- Helpers ----

const LETTER: LetterView = { at: { x: 3.6, y: 0 }, beingRead: false, text: 'A letter.', teaches: null };
const LYING: FallenItemView = { at: { x: 3.6, y: 0 }, height: 0, itemDefId: 200 };

/** The rectangle `strokes` cover, in metres. */
function boundsOf(strokes: readonly Stroke[]) {
  const points = strokes.flatMap((stroke) => stroke.points);
  const xs = points.map((point) => point.x / PIXELS_PER_METRE);
  const ys = points.map((point) => point.y / PIXELS_PER_METRE);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}
