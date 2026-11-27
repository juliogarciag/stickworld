import type { MovementTuning } from './defs';

/** Which way the player wants to walk: -1 left, 1 right, 0 not at all. */
export type WalkDirection = -1 | 0 | 1;

/** Walk this way from now on, until the next `player/walk` says otherwise. */
export interface WalkCommand {
  readonly type: 'player/walk';
  readonly direction: WalkDirection;
}

/** Jump now, or as soon as the stick man can within the forgiveness windows. */
export interface JumpCommand {
  readonly type: 'player/jump';
}

/** The jump is no longer held: a jump still rising is cut short by `letGoCut`. */
export interface LetGoOfJumpCommand {
  readonly type: 'player/letGoOfJump';
}

/**
 * Change how the stick man walks, jumps and falls from now on: each number given replaces that one, the rest stay. Dev builds
 * only send it, from the movement panel; a value that is not a number within `MOVEMENT_TUNING_LIMITS` is ignored.
 */
export interface TuneMovementCommand {
  readonly type: 'player/tuneMovement';
  readonly tuning: Partial<MovementTuning>;
}

export type PlayerCommand = WalkCommand | JumpCommand | LetGoOfJumpCommand | TuneMovementCommand;
