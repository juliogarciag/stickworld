import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import { letterDef } from './defs';
import { letterPlacedIn } from './index';
import { letterSlice } from './state';

/** The level's letter as a view needs it. */
export interface LetterView {
  /** Where it lies, or will lie once it has come down, in metres. */
  readonly at: Point;
  /** How far above that it still is, in metres: 0 once it lies on the floor. */
  readonly height: number;
  /** True while he reads it: `text` is what to show him. */
  readonly beingRead: boolean;
  readonly text: string;
}

/** The letter in the level being played, or undefined when there is none: the level has no letter, or he has read it and put it away. */
export function letterOf(handle: SimHandle): LetterView | undefined {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  const placed = letterPlacedIn(handle.levelDef);
  const def = placed && letterDef(placed.defId);
  const letter = handle.stateOf(letterSlice);
  if (!placed || !def || !letter.inLevel) return undefined;
  return { at: placed.at, height: letter.height, beingRead: letter.beingRead, text: def.text };
}
