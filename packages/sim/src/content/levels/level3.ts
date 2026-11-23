import { FLAG_DEF_ID } from '../../features/flag/defs';
import { AIRPLANE_LETTER_ID } from '../../features/letter/defs';
import type { Level } from './types';

/**
 * Level 3: a gap far too long to jump, with the flag on the far side. A
 * letter just in front of the start teaches him to fold his paper into an
 * airplane, which he carries to the edge. Flying it across is issue #5.
 */
export const level3: Level = {
  id: 3,
  name: 'A long way across',
  floor: [
    { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
    { from: { x: 19, y: 0 }, to: { x: 27, y: 0 } },
  ],
  start: { x: 2, y: 0 },
  placements: [
    { defId: AIRPLANE_LETTER_ID, at: { x: 3.6, y: 0 } },
    { defId: FLAG_DEF_ID, at: { x: 24, y: 0 } },
  ],
};
