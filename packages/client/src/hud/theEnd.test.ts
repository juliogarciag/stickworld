import { describe, expect, it } from 'vitest';
import { theEndIsWritten, theEndStrokes } from './theEnd';

describe('the end', () => {
  it('is only once the flag that ends the game has been reached and is all the way up', () => {
    expect(theEndIsWritten(undefined)).toBe(false);
    expect(theEndIsWritten({ ...LAST_FLAG, reached: false, raised: 0 })).toBe(false);
    expect(theEndIsWritten({ ...LAST_FLAG, raised: 0.5 })).toBe(false);
    expect(theEndIsWritten({ ...LAST_FLAG, endsTheGame: false })).toBe(false);
    expect(theEndIsWritten(LAST_FLAG)).toBe(true);
  });

  it('is written large across the upper half of what the camera sees, centred', () => {
    const points = theEndStrokes(CAMERA_SEES).flatMap((stroke) => stroke.points);
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    expect(points.length).toBeGreaterThan(10);
    expect(Math.min(...xs)).toBeGreaterThan(CAMERA_SEES.x);
    expect(Math.max(...xs)).toBeLessThan(CAMERA_SEES.x + CAMERA_SEES.width);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(CAMERA_SEES.x + CAMERA_SEES.width / 2, 6);
    expect(Math.min(...ys)).toBeGreaterThan(CAMERA_SEES.y);
    expect(Math.max(...ys)).toBeLessThan(CAMERA_SEES.y + CAMERA_SEES.height / 2);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(CAMERA_SEES.width / 4);
  });
});

// ---- Helpers ----

const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const LAST_FLAG = { at: { x: 24, y: 0 }, height: 2.2, reached: true, raised: 1, endsTheGame: true };
