/**
 * Play the game again from its first level. Only once it is over and playing again is offered
 * (`getGame`); ignored before.
 */
export interface GamePlayAgainCommand {
  readonly type: 'game/playAgain';
}

export type GameCommand = GamePlayAgainCommand;
