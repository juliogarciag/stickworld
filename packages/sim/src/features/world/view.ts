import { Sim, type SimHandle } from '../../core/sim';
import { getInteractionNow, type InteractionMeaning } from './index';

/** What interacting would do right now, or null when there is nothing to interact with: for a view that tells the player what the key is for. */
export function getInteraction(handle: SimHandle): InteractionMeaning | null {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return getInteractionNow(handle)?.means ?? null;
}
