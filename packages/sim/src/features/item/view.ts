import { Sim, type SimHandle } from '../../core/sim';
import { getItemUseNow, type ItemUseMeaning } from './index';

/** What using the held item would do right now, or null when it would do nothing: for a view that tells the player what the key is for. */
export function getItemUse(handle: SimHandle): ItemUseMeaning | null {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  return getItemUseNow(handle)?.means ?? null;
}
