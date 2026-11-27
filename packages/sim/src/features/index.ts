import type { Feature } from '../core/feature';
import { airplaneFeature } from './airplane';
import { checkpointFeature } from './checkpoint';
import { craftingFeature } from './crafting';
import { flagFeature } from './flag';
import { gameFeature } from './game';
import { inventoryFeature } from './inventory';
import { itemFeature } from './item';
import { letterFeature } from './letter';
import { noteFeature } from './note';
import { playerFeature } from './player';
import { worldFeature } from './world';

/**
 * Every feature the sim runs, in execution order. Register a new feature by
 * adding one line here. Order matters only between features that depend on
 * each other's work within a tick: the flag is checked after the stick man
 * has moved, and the inventory is given what a flag gives after the flag is
 * checked. `item` and `world` own the two commands whose meaning other
 * features answer for, and come before those features. The airplane follows
 * the stick man who carries it, so it comes after the stick man. `game` only hears a
 * command, so where it comes decides nothing; `note` watches where the stick man
 * stands, and comes after it so a note is rubbed out on the tick it gets there;
 * `checkpoint` also watches where the stick man stands, so it comes after the stick man too.
 */
export const features: readonly Feature[] = [gameFeature, playerFeature, flagFeature, inventoryFeature, itemFeature, worldFeature, craftingFeature, letterFeature, airplaneFeature, noteFeature, checkpointFeature];
