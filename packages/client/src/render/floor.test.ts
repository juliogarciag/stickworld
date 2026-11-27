import { levels } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { buildFloorStrokes } from './floor';
import { convertToPixels } from './units';

describe('buildFloorStrokes', () => {
  it('draws one line per floor segment of every level, from end to end, in world pixels', () => {
    for (const level of levels) {
      const strokes = buildFloorStrokes(level);
      expect(strokes).toHaveLength(level.floor.length);
      strokes.forEach((stroke, index) => {
        const { from, to } = level.floor[index]!;
        expect(stroke.points).toEqual([
          { x: convertToPixels(from.x), y: convertToPixels(from.y) },
          { x: convertToPixels(to.x), y: convertToPixels(to.y) },
        ]);
        expect(stroke.thickness).toBeGreaterThan(0);
      });
    }
  });

  it('leaves a gap between two segments undrawn', () => {
    const strokes = buildFloorStrokes({ id: 99, name: 'gap', floor: [makeSegment(0, 4), makeSegment(6, 9)], start: { x: 1, y: 0 }, placements: [] });
    expect(strokes.map((stroke) => stroke.points.map((point) => point.x))).toEqual([
      [convertToPixels(0), convertToPixels(4)],
      [convertToPixels(6), convertToPixels(9)],
    ]);
  });
});

// ---- Helpers ----

function makeSegment(fromX: number, toX: number) {
  return { from: { x: fromX, y: 0 }, to: { x: toX, y: 0 } };
}
