import { Sim, type SimHandle } from '../../core/sim';
import { isGameOver, isPlayingAgainOffered } from './index';

/** The game as a whole, as a view needs it. */
export interface GameView {
  /** True once the flag that ends the game has been reached. */
  readonly isOver: boolean;
  /** True once playing again would be heard: for a view that tells the player which key does it. */
  readonly isPlayAgainOffered: boolean;
}

export function getGame(handle: SimHandle): GameView {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return { isOver: isGameOver(handle), isPlayAgainOffered: isPlayingAgainOffered(handle) };
}
