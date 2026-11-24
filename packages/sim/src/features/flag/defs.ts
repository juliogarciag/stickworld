import type { Def } from '../../content/defs';

/** A flag on a stick. Reaching it finishes the level. */
export interface FlagDef extends Def {
  /** How tall the stick is, in metres. */
  readonly height: number;
  /** How close to the stick his feet have to be to reach it, in metres. */
  readonly reach: number;
  /** How long the flag takes to go up the stick once he reaches it, in seconds. */
  readonly raiseSeconds: number;
}

export const FLAG_DEF_ID = 100;

export const flagDef: FlagDef = { id: FLAG_DEF_ID, name: 'flag', height: 2.2, reach: 0.45, raiseSeconds: 0.6 };

export const flagDefs: readonly Def[] = [flagDef];

/** What happens once a level is finished. */
export const LEVEL_END = {
  /**
   * How long the finished level stays on the paper before the next one starts, in seconds: the flag goes up and he
   * cheers for a moment under it. The last level stays.
   */
  pauseBeforeNextLevel: 1.1,
  /** How long after the last flag he stops cheering and playing again is offered, in seconds: the end has been written by then. */
  playAgainAfter: 2.6,
} as const;
