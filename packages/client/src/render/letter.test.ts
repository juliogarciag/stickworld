import type { LetterView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { letterStrokes } from './letter';
import { PIXELS_PER_METRE } from './units';

describe('letterStrokes', () => {
  it('draws an envelope standing on the floor where the letter lies', () => {
    const strokes = letterStrokes(LYING);
    expect(strokes[0]).toMatchObject({ closed: true });
    const { left, right, top, bottom } = boundsOf(LYING);
    expect(left).toBeLessThan(LYING.at.x);
    expect(right).toBeGreaterThan(LYING.at.x);
    expect(bottom).toBeGreaterThan(LYING.at.y - 0.01);
    expect(bottom).toBeLessThan(LYING.at.y + 0.1);
    expect(top).toBeLessThan(LYING.at.y - 0.2);
  });

  it('draws it as high above that as it still is, off to a side as it sways', () => {
    const lying = boundsOf(LYING);
    const high = boundsOf({ ...LYING, height: 5 });
    expect(high.bottom).toBeLessThan(lying.bottom - 4);
    const middles = [5, 4.6, 4.2, 3.8, 3.4].map((height) => {
      const { left, right } = boundsOf({ ...LYING, height });
      return (left + right) / 2;
    });
    expect(Math.max(...middles) - Math.min(...middles)).toBeGreaterThan(0.2);
  });

  it('stands still the moment it lands: just above the floor it is where it will lie', () => {
    const lying = boundsOf(LYING);
    const landing = boundsOf({ ...LYING, height: 0.001 });
    expect(landing.left).toBeCloseTo(lying.left, 2);
    expect(landing.right).toBeCloseTo(lying.right, 2);
  });

  it('is not drawn on the floor while he reads it', () => {
    expect(letterStrokes({ ...LYING, beingRead: true })).toEqual([]);
  });
});

// ---- Helpers ----

const LYING: LetterView = { at: { x: 3.6, y: 0 }, height: 0, beingRead: false, text: 'A letter.' };

/** The rectangle the drawing of `letter` covers, in metres. */
function boundsOf(letter: LetterView) {
  const points = letterStrokes(letter).flatMap((stroke) => stroke.points);
  const xs = points.map((point) => point.x / PIXELS_PER_METRE);
  const ys = points.map((point) => point.y / PIXELS_PER_METRE);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}
