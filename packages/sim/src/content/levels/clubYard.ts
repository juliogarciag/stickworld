import { CLUB_ENEMY_ID } from '../../features/enemy/clubEnemy/defs';
import { FLAG_DEF_ID } from '../../features/flag/defs';
import { SPEAR_LETTER_ID } from '../../features/letter/defs';
import type { Level } from './types';

/**
 * A yard to try the club enemy and the spear in, before the level they are for exists (#45): one
 * floor line, the letter about the spear near the start, out of the enemy's sight, the enemy at
 * its post in the middle of the stretch it guards, and a flag behind it. It is not part
 * of the game (`practiceLevels`): its flag leads nowhere, so the stick man who reaches it cheers
 * under it, deaf to the keys, until the level is loaded again. Walking into the enemy's reach gets
 * the stick man struck down. There are two ways to the flag: read the letter, roll the paper
 * and thrust the spear at the enemy from further than its club reaches; or, without the spear,
 * make it swing at nothing and jump over it while it lifts its club (`clubYard.test.ts`).
 */
export const clubYard: Level = {
  id: 900,
  name: 'A yard with a club in it',
  floor: [{ start: { x: 0, y: 0 }, end: { x: 24, y: 0 } }],
  start: { x: 2, y: 0 },
  placements: [
    { defId: SPEAR_LETTER_ID, position: { x: 5, y: 0 } },
    { defId: FLAG_DEF_ID, position: { x: 20, y: 0 } },
  ],
  enemies: [{ defId: CLUB_ENEMY_ID, position: { x: 12, y: 0 } }],
};
