/** Which way the player wants the airplane's nose to go: 1 up, -1 down, 0 neither. */
export type SteerDirection = -1 | 0 | 1;

/**
 * Steer the airplane the stick man sits in this way from now on, until the next `airplane/steer`
 * says otherwise. Nothing happens while the stick man is not flying.
 */
export interface AirplaneSteerCommand {
  readonly type: 'airplane/steer';
  readonly direction: SteerDirection;
}

export type AirplaneCommand = AirplaneSteerCommand;
