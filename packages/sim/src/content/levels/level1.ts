import { FLAG_DEF_ID } from '../../features/flag/defs';
import type { Level } from './types';

/**
 * Level 1: the stick man walks until he finds the flag, a few metres to his
 * right. The floor ends a little behind him and a little past the flag. The
 * sheet has the game's name on it, and beside him a note about walking that
 * is rubbed out once he has.
 */
export const level1: Level = {
  id: 1,
  name: 'A walk',
  floor: [{ start: { x: 0, y: 0 }, end: { x: 14, y: 0 } }],
  start: { x: 2, y: 0 },
  placements: [{ defId: FLAG_DEF_ID, position: { x: 11, y: 0 } }],
  notes: [
    { position: { x: 2, y: -5.4 }, words: 'Stickworld', isTitle: true },
    { position: { x: 2.2, y: -2.5 }, words: 'walk', topic: 'walking', rubbedOutPast: 4.2 },
  ],
};
