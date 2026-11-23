import type { Feature } from '../core/feature';
import { flagFeature } from './flag';
import { inventoryFeature } from './inventory';
import { playerFeature } from './player';

/**
 * Every feature the sim runs, in execution order. Register a new feature by
 * adding one line here. Order matters only between features that depend on
 * each other's work within a tick: the flag is checked after the stick man
 * has moved, and the inventory is given what a flag gives after the flag is
 * checked.
 */
export const features: readonly Feature[] = [playerFeature, flagFeature, inventoryFeature];
