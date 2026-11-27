import { describe, expect, it } from 'vitest';
import { createFixedUnits } from './fixedUnits';
import { __testing__ } from './paper';

describe('the pixels of a tile a patch reaches', () => {
  it('is the square around a patch that is wholly on the tile, grown to whole pixels', () => {
    expect(getPixelsOfTileWithin({ size: 1024, x: 500.4, y: 300.6, radius: 100.2 })).toEqual({
      left: 400,
      top: 200,
      width: 201,
      height: 201,
    });
  });

  it('stops at the sides of the tile', () => {
    expect(getPixelsOfTileWithin({ size: 1024, x: 10, y: 1000, radius: 200 })).toEqual({
      left: 0,
      top: 800,
      width: 210,
      height: 224,
    });
  });

  it('is the part that comes back in on the other side for a repeat of a patch near an edge', () => {
    expect(getPixelsOfTileWithin({ size: 1024, x: 10 + 1024, y: 500, radius: 200 })).toEqual({
      left: 834,
      top: 300,
      width: 190,
      height: 400,
    });
  });

  it('is nothing for a repeat that does not reach the tile', () => {
    expect(
      getPixelsOfTileWithin({ size: 1024, x: 500 - 1024, y: 500, radius: 260 }),
    ).toBeUndefined();
    expect(
      getPixelsOfTileWithin({ size: 1024, x: 500, y: 500 + 1024, radius: 260 }),
    ).toBeUndefined();
  });

  it('is nothing for a patch that only touches a side of the tile', () => {
    expect(getPixelsOfTileWithin({ size: 1024, x: -100, y: 500, radius: 100 })).toBeUndefined();
    expect(getPixelsOfTileWithin({ size: 1024, x: 1124, y: 500, radius: 100 })).toBeUndefined();
  });

  it('is whole pixels of the tile, and every pixel of the tile the patch reaches, wherever the patch is', () => {
    const size = 64;
    const nextUnit = createFixedUnits(26);
    for (let patch = 0; patch < 500; patch += 1) {
      const x = (nextUnit() * 3 - 1) * size;
      const y = (nextUnit() * 3 - 1) * size;
      const radius = 1 + nextUnit() * size;
      const reached = getPixelsOfTileWithin({ size, x, y, radius });
      const isReached = (column: number, row: number): boolean =>
        reached !== undefined &&
        column >= reached.left &&
        column < reached.left + reached.width &&
        row >= reached.top &&
        row < reached.top + reached.height;
      if (reached) {
        expect(
          [reached.left, reached.top, reached.width, reached.height].every(Number.isInteger),
        ).toBe(true);
        expect(
          reached.left >= 0 &&
            reached.top >= 0 &&
            reached.left + reached.width <= size &&
            reached.top + reached.height <= size,
        ).toBe(true);
      }
      for (let column = 0; column < size; column += 1) {
        for (let row = 0; row < size; row += 1) {
          // A pixel any part of which is within the radius: its nearest point to the patch's middle is.
          const nearestX = Math.max(column, Math.min(column + 1, x));
          const nearestY = Math.max(row, Math.min(row + 1, y));
          if (Math.hypot(nearestX - x, nearestY - y) < radius && !isReached(column, row)) {
            expect.fail(
              `pixel ${column}, ${row} is within ${radius} of ${x}, ${y} and is not filled`,
            );
          }
        }
      }
    }
  });
});

// ---- Helpers ----

const { getPixelsOfTileWithin } = __testing__;
