import { CLUB_ENEMY_ID } from '../../features/enemy/clubEnemy/defs';
import { FLAG_DEF_ID } from '../../features/flag/defs';
import { SPEAR_LETTER_ID } from '../../features/letter/defs';
import type { Level } from './types';

/**
 * TRYOUT (#44, comes out before merge): a long floor with the letter about the spear and five club
 * enemies in a row, each with a stretch of its own, to see what the halves of many torn enemies
 * add up to. Not part of the game, and with no play tests of its own: it goes when the tryout
 * does.
 */
export const clubRow: Level = {
  id: 901,
  name: 'A row of clubs',
  floor: [{ start: { x: 0, y: 0 }, end: { x: 72, y: 0 } }],
  start: { x: 2, y: 0 },
  placements: [
    { defId: SPEAR_LETTER_ID, position: { x: 5, y: 0 } },
    { defId: FLAG_DEF_ID, position: { x: 68, y: 0 } },
  ],
  enemies: [14, 24, 34, 44, 54].map((x) => ({ defId: CLUB_ENEMY_ID, position: { x, y: 0 } })),
};
