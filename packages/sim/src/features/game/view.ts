import { Sim, type SimHandle } from '../../core/sim';
import { gameIsOver, playingAgainIsOffered } from './index';

/** The game as a whole, as a view needs it. */
export interface GameView {
  /** True once the flag that ends the game has been reached. */
  readonly over: boolean;
  /** True once playing again would be heard: for a view that tells the player which key does it. */
  readonly playingAgainOffered: boolean;
}

export function gameOf(handle: SimHandle): GameView {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return { over: gameIsOver(handle), playingAgainOffered: playingAgainIsOffered(handle) };
}
