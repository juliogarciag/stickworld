import { levels } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { floorStrokes } from './floor';
import { toPixels } from './units';

describe('floorStrokes', () => {
  it('draws one line per floor segment of every level, from end to end, in world pixels', () => {
    for (const level of levels) {
      const strokes = floorStrokes(level);
      expect(strokes).toHaveLength(level.floor.length);
      strokes.forEach((stroke, index) => {
        const { from, to } = level.floor[index]!;
        expect(stroke.points).toEqual([
          { x: toPixels(from.x), y: toPixels(from.y) },
          { x: toPixels(to.x), y: toPixels(to.y) },
        ]);
        expect(stroke.thickness).toBeGreaterThan(0);
      });
    }
  });

  it('leaves a gap between two segments undrawn', () => {
    const strokes = floorStrokes({ id: 99, name: 'gap', floor: [SEGMENT(0, 4), SEGMENT(6, 9)], start: { x: 1, y: 0 }, placements: [] });
    expect(strokes.map((stroke) => stroke.points.map((point) => point.x))).toEqual([
      [toPixels(0), toPixels(4)],
      [toPixels(6), toPixels(9)],
    ]);
  });
});

// ---- Helpers ----

function SEGMENT(fromX: number, toX: number) {
  return { from: { x: fromX, y: 0 }, to: { x: toX, y: 0 } };
}
