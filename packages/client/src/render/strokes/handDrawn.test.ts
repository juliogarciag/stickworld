import { describe, expect, it } from 'vitest';
import { getBoilFrameAt, buildHandDrawnPath, type PencilPoint } from './handDrawn';
import { PENCIL } from './pencil';
import type { Stroke } from './stroke';

describe('buildHandDrawnPath', () => {
  it('draws the same path for the same stroke on the same redraw', () => {
    expect(buildHandDrawnPath(FLOOR, { strokeIndex: 3, boilFrame: 7 })).toEqual(buildHandDrawnPath(FLOOR, { strokeIndex: 3, boilFrame: 7 }));
  });

  it('draws a different path on the next redraw, which is what makes a still line boil', () => {
    expect(buildHandDrawnPath(FLOOR, { strokeIndex: 3, boilFrame: 8 })).not.toEqual(buildHandDrawnPath(FLOOR, { strokeIndex: 3, boilFrame: 7 }));
  });

  it('does not wobble two strokes of a layer alike', () => {
    const getOffsets = (strokeIndex: number): number[] => buildHandDrawnPath(FLOOR, { strokeIndex, boilFrame: 0 }).map((point) => point.y);
    expect(getOffsets(0)).not.toEqual(getOffsets(1));
  });

  it('never strays further from the exact line than the wobble, on any redraw', () => {
    for (let boilFrame = 0; boilFrame < 50; boilFrame += 1) {
      for (const point of buildHandDrawnPath(FLOOR, { strokeIndex: 0, boilFrame })) {
        expect(Math.abs(point.y - 100)).toBeLessThanOrEqual(PENCIL.wobble);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(600);
      }
    }
  });

  it('gives a straight line enough points to be uneven along its whole length', () => {
    const path = buildHandDrawnPath(FLOOR, { strokeIndex: 0, boilFrame: 0 });
    expect(path.length).toBe(600 / PENCIL.pointSpacing + 1);
    expect(new Set(path.map((point) => point.y)).size).toBeGreaterThan(path.length / 2);
  });

  it('keeps every corner of the path it was asked for', () => {
    const knee = { x: 30, y: 40 };
    const path = buildHandDrawnPath({ points: [{ x: 0, y: 0 }, knee, { x: 10, y: 90 }], thickness: 4 }, { strokeIndex: 0, boilFrame: 0 });
    expect(Math.min(...path.map((point) => measureDistance(point, knee)))).toBeLessThanOrEqual(PENCIL.wobble);
  });

  it('presses lighter where the pencil touches down and lifts than in the middle', () => {
    const path = buildHandDrawnPath(FLOOR, { strokeIndex: 0, boilFrame: 0 });
    const middle = path[Math.floor(path.length / 2)]!;
    expect(path[0]!.pressure).toBeLessThan(middle.pressure);
    expect(path[path.length - 1]!.pressure).toBeLessThan(middle.pressure);
    for (const point of path) {
      expect(point.pressure).toBeGreaterThan(0);
      expect(point.pressure).toBeLessThanOrEqual(1);
    }
  });

  it('takes a closed loop past where it started', () => {
    const open = buildHandDrawnPath({ ...SQUARE, closed: false }, { strokeIndex: 0, boilFrame: 0 });
    const closed = buildHandDrawnPath(SQUARE, { strokeIndex: 0, boilFrame: 0 });
    expect(measureLength(open)).toBeGreaterThan(120 - 4 * PENCIL.wobble);
    expect(measureLength(open)).toBeLessThan(120 + 4 * PENCIL.wobble);
    expect(measureLength(closed)).toBeGreaterThan(160);
    expect(measureLength(closed)).toBeLessThan(160 + PENCIL.loopOverlap + 4 * PENCIL.wobble + PENCIL.pointSpacing);
  });

  it('draws nothing for a stroke with no length', () => {
    expect(buildHandDrawnPath({ points: [], thickness: 4 }, { strokeIndex: 0, boilFrame: 0 })).toEqual([]);
    expect(buildHandDrawnPath({ points: [{ x: 5, y: 5 }], thickness: 4 }, { strokeIndex: 0, boilFrame: 0 })).toEqual([]);
    expect(buildHandDrawnPath({ points: [{ x: 5, y: 5 }, { x: 5, y: 5 }], thickness: 4 }, { strokeIndex: 0, boilFrame: 0 })).toEqual([]);
  });

  it('skips a piece that goes nowhere a number can say, instead of drawing it for ever', () => {
    const path = buildHandDrawnPath({ points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: Infinity, y: 0 }, { x: Number.NaN, y: 5 }], thickness: 4 }, { strokeIndex: 0, boilFrame: 0 });
    expect(path.length).toBe(30 / PENCIL.pointSpacing + 1);
    for (const point of path) expect([point.x, point.y, point.pressure].every(Number.isFinite)).toBe(true);
  });

  it('draws only finite numbers', () => {
    const path = buildHandDrawnPath({ points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 3, y: 0 }, { x: -2000, y: 1e6 }], thickness: 4 }, { strokeIndex: 9, boilFrame: 123456 });
    for (const point of path) expect([point.x, point.y, point.pressure].every(Number.isFinite)).toBe(true);
  });
});

describe('getBoilFrameAt', () => {
  it('changes as many times a second as the pencil boils', () => {
    const frames = new Set<number>();
    for (let millisecond = 0; millisecond < 1000; millisecond += 1) frames.add(getBoilFrameAt(millisecond / 1000));
    expect(frames.size).toBe(PENCIL.boilsPerSecond);
  });
});

// ---- Helpers ----

const FLOOR: Stroke = { points: [{ x: 0, y: 100 }, { x: 600, y: 100 }], thickness: PENCIL.thickness };

const SQUARE: Stroke = { points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }], thickness: 4, closed: true };

function measureDistance(first: { x: number; y: number }, second: { x: number; y: number }): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function measureLength(path: readonly PencilPoint[]): number {
  return path.slice(1).reduce((total, point, index) => total + measureDistance(point, path[index]!), 0);
}
