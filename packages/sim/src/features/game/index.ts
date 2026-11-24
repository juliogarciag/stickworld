import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { isTheLastLevel } from '../flag';
import { flagSlice } from '../flag/state';
import { GAME_END } from './defs';

/**
 * The game as a whole: it is over once the last level's flag is reached, and
 * a little later playing again is offered. `'game/playAgain'` then starts the
 * first level with nothing kept from the game before. Which flag ends the
 * game is the `flag` feature's; this one owns what comes after it.
 */
export const gameFeature: Feature = {
  name: 'game',

  handleCommand(sim, command) {
    if (command.type !== 'game/playAgain') return;
    if (playingAgainIsOffered(sim)) sim.startOver();
  },
};

/** True once the flag that ends the game has been reached. */
export function gameIsOver(sim: Sim): boolean {
  return isTheLastLevel(sim.levelDef) && sim.stateOf(flagSlice).reachedAtTick !== null;
}

/** True once the game has been over for long enough: he is done cheering and walks about again, and `'game/playAgain'` is heard. Counted in whole ticks, as the pause after a flag is. */
export function playingAgainIsOffered(sim: Sim): boolean {
  const { reachedAtTick } = sim.stateOf(flagSlice);
  return gameIsOver(sim) && reachedAtTick !== null && sim.tick - reachedAtTick >= Math.round(GAME_END.playAgainAfter / sim.dt);
}
