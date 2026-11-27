import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { getRecipeDef } from '../crafting/defs';
import { getLetterDef } from './defs';
import { findLetterPlacedIn } from './index';
import { fallenItemSlice, letterSlice } from './state';

/** The level's letter as a view needs it. */
export interface LetterView {
  /** Where it lies, in metres. */
  readonly position: Point;
  /** True while he reads it: `text` is what to show him. */
  readonly isBeingRead: boolean;
  readonly text: string;
  /** The name of the recipe that reading it teaches, or null when it teaches none. */
  readonly teaches: string | null;
}

/** The letter in the level being played, or undefined when there is none: the level has no letter, or he has read it and put it away. */
export function getLetter(handle: SimHandle): LetterView | undefined {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const placed = findLetterPlacedIn(handle.levelDef);
  const def = placed && getLetterDef(placed.defId);
  const letter = handle.getStateOf(letterSlice);
  if (!placed || !def || !letter.isInLevel) return undefined;
  return { position: placed.position, isBeingRead: letter.isBeingRead, text: def.text, teaches: getRecipeDef(def.teachesRecipe)?.name ?? null };
}

/** The item that falls from the sky for him who has lost it, as a view needs it. */
export interface FallenItemView {
  /** Where it lies, or will lie once it has come down, in metres. */
  readonly position: Point;
  /** How far above that it still is, in metres: 0 once it lies on the floor, where it can be picked up. */
  readonly height: number;
  /** The def id of the item it is. */
  readonly itemDefId: number;
}

/** The item on its way down or lying on the floor, or undefined when there is none. */
export function getFallenItem(handle: SimHandle): FallenItemView | undefined {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const placed = findLetterPlacedIn(handle.levelDef);
  const def = placed && getLetterDef(placed.defId);
  const fallen = handle.getStateOf(fallenItemSlice);
  if (!placed || !def || !fallen.isInLevel) return undefined;
  return { position: { x: fallen.x, y: fallen.y }, height: fallen.height, itemDefId: def.gives };
}
