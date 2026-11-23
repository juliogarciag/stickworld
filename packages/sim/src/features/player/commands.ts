/** Which way the player wants to walk: -1 left, 1 right, 0 not at all. */
export type WalkDirection = -1 | 0 | 1;

/** Walk this way from now on, until the next `player/walk` says otherwise. */
export interface WalkCommand {
  readonly type: 'player/walk';
  readonly direction: WalkDirection;
}

/** Jump now, or as soon as he can within the forgiveness windows. */
export interface JumpCommand {
  readonly type: 'player/jump';
}

export type PlayerCommand = WalkCommand | JumpCommand;
