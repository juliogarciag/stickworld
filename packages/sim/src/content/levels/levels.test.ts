import { describe, expect, it } from 'vitest';
import { levels } from '.';

describe('levels', () => {
  it('have unique ids, counted from 1 in the order they are played', () => {
    expect(levels.map((level) => level.id)).toEqual(levels.map((_, index) => index + 1));
  });

  describe.each(levels.map((level) => [level.id, level] as const))('level %i', (_, level) => {
    it('has a floor of segments that run left to right and do not overlap', () => {
      expect(level.floor.length).toBeGreaterThan(0);
      for (const segment of level.floor) expect(segment.to.x).toBeGreaterThan(segment.from.x);
      for (let index = 1; index < level.floor.length; index += 1) {
        expect(level.floor[index].from.x).toBeGreaterThanOrEqual(level.floor[index - 1].to.x);
      }
    });

    it('starts the stick man over the floor', () => {
      expect(level.floor.some((segment) => segment.from.x <= level.start.x && level.start.x <= segment.to.x)).toBe(true);
    });
  });
});
