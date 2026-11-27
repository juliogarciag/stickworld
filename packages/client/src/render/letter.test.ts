import type { FallenItemView, LetterView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { buildFallenPaperStrokes, buildLetterStrokes } from './letter';
import type { Stroke } from './strokes';
import { PIXELS_PER_METRE } from './units';

describe('buildLetterStrokes', () => {
  it('draws an envelope standing on the floor where the letter lies', () => {
    const strokes = buildLetterStrokes(LETTER);
    expect(strokes[0]).toMatchObject({ isClosed: true });
    const { left, right, top, bottom } = getBounds(strokes);
    expect(left).toBeLessThan(LETTER.position.x);
    expect(right).toBeGreaterThan(LETTER.position.x);
    expect(bottom).toBeGreaterThan(LETTER.position.y - 0.01);
    expect(bottom).toBeLessThan(LETTER.position.y + 0.1);
    expect(top).toBeLessThan(LETTER.position.y - 0.2);
  });

  it('is not drawn on the floor while he reads it', () => {
    expect(buildLetterStrokes({ ...LETTER, isBeingRead: true })).toEqual([]);
  });
});

describe('buildFallenPaperStrokes', () => {
  it('draws a sheet lying on the floor where it fell: wide, low, and not an envelope', () => {
    const { left, right, top, bottom } = getBounds(buildFallenPaperStrokes(LYING));
    expect(left).toBeLessThan(LYING.position.x);
    expect(right).toBeGreaterThan(LYING.position.x);
    expect(bottom).toBeLessThan(LYING.position.y + 0.1);
    expect(right - left).toBeGreaterThan(2 * (bottom - top));
    const envelope = getBounds(buildLetterStrokes(LETTER));
    expect(bottom - top).toBeLessThan(envelope.bottom - envelope.top);
  });

  it('draws it as high above that as it still is, off to a side as it sways', () => {
    const lying = getBounds(buildFallenPaperStrokes(LYING));
    const high = getBounds(buildFallenPaperStrokes({ ...LYING, height: 5 }));
    expect(high.bottom).toBeLessThan(lying.bottom - 4);
    const middles = [5, 4.6, 4.2, 3.8, 3.4].map((height) => {
      const { left, right } = getBounds(buildFallenPaperStrokes({ ...LYING, height }));
      return (left + right) / 2;
    });
    expect(Math.max(...middles) - Math.min(...middles)).toBeGreaterThan(0.2);
  });

  it('lies still the moment it lands: just above the floor it is where it will lie', () => {
    const lying = getBounds(buildFallenPaperStrokes(LYING));
    const landing = getBounds(buildFallenPaperStrokes({ ...LYING, height: 0.001 }));
    expect(landing.left).toBeCloseTo(lying.left, 2);
    expect(landing.right).toBeCloseTo(lying.right, 2);
  });
});

// ---- Helpers ----

const LETTER: LetterView = { position: { x: 3.6, y: 0 }, isBeingRead: false, text: 'A letter.', teaches: null };
const LYING: FallenItemView = { position: { x: 3.6, y: 0 }, height: 0, itemDefId: 200 };

/** The rectangle `strokes` cover, in metres. */
function getBounds(strokes: readonly Stroke[]) {
  const points = strokes.flatMap((stroke) => stroke.points);
  const xs = points.map((point) => point.x / PIXELS_PER_METRE);
  const ys = points.map((point) => point.y / PIXELS_PER_METRE);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}
