import type { Level } from './types';

/**
 * Level 1: the stick man walks until he finds the flag. Only the floor and
 * the start exist so far; the Level 1 ticket places the flag and tunes the
 * distance.
 */
export const level1: Level = {
  id: 1,
  name: 'A walk',
  floor: [{ from: { x: 0, y: 0 }, to: { x: 12, y: 0 } }],
  start: { x: 1, y: 0 },
  placements: [],
};
