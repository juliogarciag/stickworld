import { Sim, type SimHandle } from '../../core/sim';
import { itemUseNow, type ItemUseMeaning } from './index';

/** What using the held item would do right now, or null when it would do nothing: for a view that tells the player what the key is for. */
export function itemUseOf(handle: SimHandle): ItemUseMeaning | null {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return itemUseNow(handle)?.means ?? null;
}
