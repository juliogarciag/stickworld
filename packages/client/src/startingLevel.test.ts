import { levels } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { getStartingLevel } from './startingLevel';

describe('getStartingLevel', () => {
  it('starts on the level VITE_LEVEL names', () => {
    const last = levels[levels.length - 1]?.id;
    expect(getStartingLevel(String(last))).toBe(last);
  });

  it.each([undefined, '', 'two', '0', '999', '1.5'])(
    'starts on the first level for %j',
    (configured) => {
      expect(getStartingLevel(configured)).toBe(levels[0]?.id);
    },
  );
});
