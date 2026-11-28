import { CLUB_ENEMY_ID } from '../../features/enemy/defs';
import { FLAG_DEF_ID } from '../../features/flag/defs';
import type { Level } from './types';

/**
 * A yard to try the club enemy in, before the level it is for exists (#45): one floor line, the
 * enemy at its post in the middle of the stretch it guards, and a flag behind it. It is not part
 * of the game (`practiceLevels`): its flag leads nowhere. Walking into the enemy's reach gets the
 * stick man struck down; the way to the flag is to make it swing at nothing and jump over it
 * while it lifts its club (`clubYard.test.ts`).
 */
export const clubYard: Level = {
  id: 900,
  name: 'A yard with a club in it',
  floor: [{ start: { x: 0, y: 0 }, end: { x: 24, y: 0 } }],
  start: { x: 2, y: 0 },
  placements: [{ defId: FLAG_DEF_ID, position: { x: 20, y: 0 } }],
  enemies: [{ defId: CLUB_ENEMY_ID, position: { x: 12, y: 0 } }],
};
