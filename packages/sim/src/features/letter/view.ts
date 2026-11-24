import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { recipeDef } from '../crafting/defs';
import { letterDef } from './defs';
import { letterPlacedIn } from './index';
import { letterSlice } from './state';

/** The level's letter as a view needs it. */
export interface LetterView {
  /** Where it lies, or will lie once it has come down, in metres. */
  readonly at: Point;
  /** How far above that it still is, in metres: 0 once it lies on the floor. */
  readonly height: number;
  /** True once it has been read: it lies there opened, and can be read again. */
  readonly opened: boolean;
  /** True while he reads it: `text` is what to show him. */
  readonly beingRead: boolean;
  readonly text: string;
  /** The name of the recipe that reading it teaches, or null when it teaches none. */
  readonly teaches: string | null;
}

/** The letter in the level being played, or undefined when the level has none. */
export function letterOf(handle: SimHandle): LetterView | undefined {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const placed = letterPlacedIn(handle.levelDef);
  const def = placed && letterDef(placed.defId);
  const letter = handle.stateOf(letterSlice);
  if (!placed || !def) return undefined;
  return { at: placed.at, height: letter.height, opened: letter.opened, beingRead: letter.beingRead, text: def.text, teaches: recipeDef(def.teachesRecipe)?.name ?? null };
}
