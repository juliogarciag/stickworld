import { FLAG_DEF_ID } from '../../features/flag/defs';
import type { Level } from './types';

/**
 * Level 1: the stick man walks until he finds the flag, a few metres to his
 * right. The floor ends a little behind him and a little past the flag.
 */
export const level1: Level = {
  id: 1,
  name: 'A walk',
  floor: [{ from: { x: 0, y: 0 }, to: { x: 14, y: 0 } }],
  start: { x: 2, y: 0 },
  placements: [{ defId: FLAG_DEF_ID, at: { x: 11, y: 0 } }],
};
