import { Sim, type SimHandle } from '../../core/sim';
import { interactionNow, type InteractionMeaning } from './index';

/** What interacting would do right now, or null when there is nothing to interact with: for a view that tells the player what the key is for. */
export function interactionOf(handle: SimHandle): InteractionMeaning | null {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return interactionNow(handle)?.means ?? null;
}
