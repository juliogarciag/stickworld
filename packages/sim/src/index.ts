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
export { getLevel } from './core/view';
export { FIXED_DT, STICK_MAN_HEIGHT, STICK_MAN_WIDTH, TICK_RATE } from './content/tuning';
export { defs, getDef, type Def } from './content/defs';
export { getLevelById, levels } from './content/levels';
export type { FloorSegment, Level, Note, Placement, Point } from './content/levels/types';
export type { JumpCommand, LetGoOfJumpCommand, PlayerCommand, TuneMovementCommand, WalkCommand, WalkDirection } from './features/player/commands';
export { getMovementTuning, getStickMan, type StickManView } from './features/player/view';
export { MOVEMENT_PRESETS, MOVEMENT_TUNING_LIMITS, type MovementPresetName, type MovementTuning } from './features/player/defs';
export { getFlag, type FlagView } from './features/flag/view';
export type { InventoryCommand, InventorySelectCommand } from './features/inventory/commands';
export { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from './features/inventory/defs';
export { getItemSlots, type ItemSlot } from './features/inventory/view';
export type { ItemCommand, ItemUseCommand } from './features/item/commands';
export type { ItemUseMeaning } from './features/item';
export { getItemUse } from './features/item/view';
export type { WorldCommand, WorldInteractCommand } from './features/world/commands';
export type { InteractionMeaning } from './features/world';
export { getInteraction } from './features/world/view';
export { getCrafting, type CraftingView, type RecipeView } from './features/crafting/view';
export { getFallenItem, getLetter, type FallenItemView, type LetterView } from './features/letter/view';
export type { AirplaneCommand, AirplaneSteerCommand, SteerDirection } from './features/airplane/commands';
export { getAirplane, getFlyingHint, getSteeringAsked, type AirplaneView, type FlyingHint } from './features/airplane/view';
export type { GameCommand, GamePlayAgainCommand } from './features/game/commands';
export { getGame, type GameView } from './features/game/view';
export { getNotes, type NoteView } from './features/note/view';
