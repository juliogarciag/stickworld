/**
 * Public API of the simulation.
 *
 * The client imports ONLY from this file. Everything else in
 * packages/sim/src is internal. Add an export here when a feature needs to
 * expose something to a view.
 */
export { createSim, restoreSim, type CreateSimOptions } from './core/create';
export type { SimHandle } from './core/sim';
export type { Command } from './core/commands';
export { hashSnapshot, type SimSnapshot } from './core/snapshot';
export { levelOf } from './core/view';
export { FIXED_DT, STICK_MAN_HEIGHT, TICK_RATE } from './content/tuning';
export { defs, getDef, type Def } from './content/defs';
export { levelById, levels } from './content/levels';
export type { FloorSegment, Level, Placement, Point } from './content/levels/types';
