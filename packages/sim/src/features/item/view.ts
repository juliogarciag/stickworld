import { Sim, type SimHandle } from '../../core/sim';
import { findItemUseSwitch, getItemUseNow, type ItemUseMeaning } from './index';

/**
 * What using the held item would do right now, or null when it would do nothing: for a view that
 * tells the player what the key is for.
 */
export function getItemUse(handle: SimHandle): ItemUseMeaning | null {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  return getItemUseNow(handle)?.means ?? null;
}

/**
 * True while switching the use of the held item would do something: the item has another use right
 * now. For a view that shows the key for it.
 */
export function canSwitchItemUse(handle: SimHandle): boolean {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  return findItemUseSwitch(handle) !== undefined;
}
