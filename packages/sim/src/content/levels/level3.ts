import { FLAG_DEF_ID } from '../../features/flag/defs';
import { AIRPLANE_LETTER_ID } from '../../features/letter/defs';
import type { Level } from './types';

/**
 * Level 3, the last: a gap far too long to jump, with the flag on the far
 * side. A letter just in front of the start teaches him to fold his paper
 * into an airplane, which he carries to the edge, boards and flies across.
 * The gap is tuned together with the glide (`FLIGHT` in the airplane's
 * defs): doing nothing sinks short of the far side, climbing for too long
 * stalls over the gap, and a climb of the right length crosses
 * (`level3.test.ts` holds the window). The far side is long enough to land on
 * from any flight that crosses.
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
