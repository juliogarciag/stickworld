import { FLAG_DEF_ID } from '../../features/flag/defs';
import { AIRPLANE_LETTER_ID } from '../../features/letter/defs';
import type { Level } from './types';

/**
 * Level 3, the last: a gap far too long to jump, with the flag on the far
 * side. A letter just in front of the start teaches the stick man to fold its paper
 * into an airplane, which it carries to the edge, boards and flies across.
 * The gap is tuned together with the glide (`FLIGHT` in the airplane's
 * defs): doing nothing sinks short of the far side, climbing for too long
 * stalls over the gap, and a climb of the right length crosses
 * (`level3.test.ts` holds the window). The far side is long enough to land on
 * from any such flight; one that is kept in the air for longer can still come
 * down too late and slide off the end of the paper.
 */
export const level3: Level = {
  id: 3,
  name: 'A long way across',
  floor: [
    { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    { start: { x: 19, y: 0 }, end: { x: 27, y: 0 } },
  ],
  start: { x: 2, y: 0 },
  // Past the letter and short of where the airplane is set down: a retry begins a few steps from
  // the edge.
  checkpoint: { x: 7, y: 0 },
  placements: [
    { defId: AIRPLANE_LETTER_ID, position: { x: 3.6, y: 0 } },
    { defId: FLAG_DEF_ID, position: { x: 24, y: 0 } },
  ],
};
