import { FLAG_DEF_ID } from '../../features/flag/defs';
import { PAPER_ITEM_ID } from '../../features/inventory/defs';
import type { Level } from './types';

/**
 * Level 2: a gap in the line. A jump clears it and a walk does not; falling
 * in is a death, which starts the level again. The flag past the gap gives
 * the paper, which he keeps from then on. A note before the gap says to
 * jump, and is rubbed out once he stands on the far side.
 */
export const level2: Level = {
  id: 2,
  name: 'A gap',
  floor: [
    { from: { x: 0, y: 0 }, to: { x: 6, y: 0 } },
    { from: { x: 6.8, y: 0 }, to: { x: 14, y: 0 } },
  ],
  start: { x: 2, y: 0 },
  placements: [{ defId: FLAG_DEF_ID, at: { x: 11, y: 0 } }],
  flagGivesItem: PAPER_ITEM_ID,
  notes: [{ at: { x: 5, y: -2.5 }, words: 'jump', about: 'jumping', rubbedOutPast: 6.8 }],
};
