import { describe, expect, it } from 'vitest';
import { levels } from '.';
import { getDef } from '../defs';
import { STICK_MAN_WIDTH } from '../tuning';

describe('levels', () => {
  it('have unique ids, counted from 1 in the order they are played', () => {
    expect(levels.map((level) => level.id)).toEqual(levels.map((_, index) => index + 1));
  });

  describe.each(levels.map((level) => [level.id, level] as const))('level %i', (_, level) => {
    it('has a floor of segments that run left to right and do not overlap', () => {
      expect(level.floor.length).toBeGreaterThan(0);
      for (const segment of level.floor) expect(segment.end.x).toBeGreaterThan(segment.start.x);
      for (let index = 1; index < level.floor.length; index += 1) {
        expect(level.floor[index].start.x).toBeGreaterThanOrEqual(level.floor[index - 1].end.x);
      }
    });

    it('has a flat floor, all at one height: landing and dropping past the end of a line are worked out for nothing else yet', () => {
      for (const segment of level.floor) {
        expect(segment.end.y).toBe(segment.start.y);
        expect(segment.start.y).toBe(level.floor[0].start.y);
      }
    });

    it('has no gap he is too wide to fall into: the two ends of a gap never push him at once', () => {
      for (let index = 1; index < level.floor.length; index += 1) {
        const gap = level.floor[index].start.x - level.floor[index - 1].end.x;
        if (gap > 0) expect(gap).toBeGreaterThan(STICK_MAN_WIDTH);
      }
    });

    it('starts the stick man over the floor', () => {
      expect(level.floor.some((segment) => segment.start.x <= level.start.x && level.start.x <= segment.end.x)).toBe(true);
    });

    it('places only things that have a def', () => {
      for (const placement of level.placements) expect(getDef(placement.defId), `def ${placement.defId}`).toBeDefined();
    });
  });
});
