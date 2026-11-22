import { levels } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { startingLevel } from './startingLevel';

describe('startingLevel', () => {
  it('starts on the level VITE_LEVEL names', () => {
    const last = levels[levels.length - 1]?.id;
    expect(startingLevel(String(last))).toBe(last);
  });

  it.each([undefined, '', 'two', '0', '999', '1.5'])('starts on the first level for %j', (configured) => {
    expect(startingLevel(configured)).toBe(levels[0]?.id);
  });
});
