import { describe, expect, it } from 'vitest';
import { __testing__ } from './paper';

const { pixelsOfTileWithin } = __testing__;

describe('the pixels of a tile a patch reaches', () => {
  it('is the square around a patch that is wholly on the tile, grown to whole pixels', () => {
    expect(pixelsOfTileWithin({ size: 1024, x: 500.4, y: 300.6, radius: 100.2 })).toEqual({ left: 400, top: 200, width: 201, height: 201 });
  });

  it('stops at the sides of the tile', () => {
    expect(pixelsOfTileWithin({ size: 1024, x: 10, y: 1000, radius: 200 })).toEqual({ left: 0, top: 800, width: 210, height: 224 });
  });

  it('is the part that comes back in on the other side for a repeat of a patch near an edge', () => {
    expect(pixelsOfTileWithin({ size: 1024, x: 10 + 1024, y: 500, radius: 200 })).toEqual({ left: 834, top: 300, width: 190, height: 400 });
  });

  it('is nothing for a repeat that does not reach the tile', () => {
    expect(pixelsOfTileWithin({ size: 1024, x: 500 - 1024, y: 500, radius: 260 })).toBeUndefined();
    expect(pixelsOfTileWithin({ size: 1024, x: 500, y: 500 + 1024, radius: 260 })).toBeUndefined();
  });

  it('is nothing for a patch that only touches a side of the tile', () => {
    expect(pixelsOfTileWithin({ size: 1024, x: -100, y: 500, radius: 100 })).toBeUndefined();
    expect(pixelsOfTileWithin({ size: 1024, x: 1124, y: 500, radius: 100 })).toBeUndefined();
  });
});
