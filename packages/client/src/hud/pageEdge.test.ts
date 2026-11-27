import { describe, expect, it } from 'vitest';
import { buildPageEdgeStrokes } from './pageEdge';

describe('the edge of a sheet being turned away', () => {
  it('is a line from above the view to below it, where the sheet ends, with its shadow as hatching on the sheet under it', () => {
    const [line, ...hatches] = buildPageEdgeStrokes(0.5, SEEN);
    const x = SEEN.x + SEEN.width / 2;
    expect(line!.points.map((point) => point.x)).toEqual([x, x]);
    expect(line!.points[0]!.y).toBeLessThan(SEEN.y);
    expect(line!.points[1]!.y).toBeGreaterThan(SEEN.y + SEEN.height);
    expect(hatches.length).toBeGreaterThan(20);
    for (const hatch of hatches) {
      expect(hatch.thickness).toBeLessThan(line!.thickness);
      for (const point of hatch.points) {
        expect(point.x).toBeGreaterThan(x);
      }
    }
    const hatchYs = hatches.flatMap((hatch) => hatch.points.map((point) => point.y));
    expect(Math.min(...hatchYs)).toBeLessThan(SEEN.y);
    expect(Math.max(...hatchYs)).toBeGreaterThan(SEEN.y + SEEN.height);
  });

  it('moves with the sheet, and is the same hatching wherever it is', () => {
    const getPointXsAt = (edgeAt: number): number[] =>
      buildPageEdgeStrokes(edgeAt, SEEN).flatMap((stroke) =>
        stroke.points.map((point) => point.x - (SEEN.x + edgeAt * SEEN.width)),
      );
    expect(getPointXsAt(0.2)).toEqual(getPointXsAt(0.9).map((x) => expect.closeTo(x, 6)));
  });
});

// ---- Helpers ----

const SEEN = { x: 40, y: -20, width: 1920, height: 1080 };
