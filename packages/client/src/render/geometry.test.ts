import { describe, expect, it } from 'vitest';
import { distanceBetweenLines } from './geometry';

describe('the distance between two lines', () => {
  it('is 0 when they cross', () => {
    expect(distanceBetweenLines([{ x: 0, y: 0 }, { x: 2, y: 2 }], [{ x: 0, y: 2 }, { x: 2, y: 0 }])).toBe(0);
  });

  it('is 0 when one ends on the other', () => {
    expect(distanceBetweenLines([{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ x: 1, y: 0 }, { x: 1, y: 3 }])).toBe(0);
  });

  it('is how far the nearest end of one is from the other', () => {
    expect(distanceBetweenLines([{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ x: 1, y: 0.5 }, { x: 1, y: 3 }])).toBeCloseTo(0.5, 9);
    expect(distanceBetweenLines([{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ x: 5, y: 4 }, { x: 9, y: 4 }])).toBeCloseTo(5, 9);
  });

  it('is not 0 for a line that would cross the other only if the other went on past its end', () => {
    expect(distanceBetweenLines([{ x: 0, y: 0 }, { x: 2, y: 0 }], [{ x: 3, y: -1 }, { x: 3, y: 1 }])).toBeCloseTo(1, 9);
  });

  it('takes twice the same point as that point', () => {
    expect(distanceBetweenLines([{ x: 1, y: 1 }, { x: 1, y: 1 }], [{ x: 0, y: 0 }, { x: 2, y: 0 }])).toBeCloseTo(1, 9);
  });
});
