import type { Feature } from '../core/feature';
import { flagFeature } from './flag';
import { playerFeature } from './player';

/**
 * Every feature the sim runs, in execution order. Register a new feature by
 * adding one line here. Order matters only between features that depend on
 * each other's work within a tick: the flag is checked after the stick man
 * has moved.
 */
export const features: readonly Feature[] = [playerFeature, flagFeature];
