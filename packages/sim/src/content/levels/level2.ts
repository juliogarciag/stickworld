import type { Level } from './types';

/**
 * Level 2: a gap in the line. A jump clears it and a walk does not; falling
 * in is a death, which starts the level again. The flag past the gap gives
 * the paper.
 */
export const level2: Level = {
  id: 2,
  name: 'A gap',
  floor: [
    { from: { x: 0, y: 0 }, to: { x: 6, y: 0 } },
    { from: { x: 7.5, y: 0 }, to: { x: 14, y: 0 } },
  ],
  start: { x: 1, y: 0 },
  placements: [],
};
