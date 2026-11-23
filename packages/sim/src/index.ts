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
export type { JumpCommand, PlayerCommand, WalkCommand, WalkDirection } from './features/player/commands';
export { stickManOf, type StickManView } from './features/player/view';
export { flagOf, type FlagView } from './features/flag/view';
export type { InventoryCommand, InventorySelectCommand } from './features/inventory/commands';
export { PAPER_ITEM_ID } from './features/inventory/defs';
export { itemSlotsOf, type ItemSlot } from './features/inventory/view';
