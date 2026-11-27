import type { Sim } from '../../core/sim';
import { isItemDefId } from './defs';
import { inventorySlice } from './state';

/**
 * Puts the item `itemDefId` in the first empty slot, and says whether the stick man
 * holds it afterwards. An item the stick man already holds is not given twice; with
 * every slot taken, or for an id that is not an item's, nothing changes.
 * For the features whose rules hand out items (a flag, a recipe).
 */
export function giveItem(sim: Sim, itemDefId: number): boolean {
  if (!isItemDefId(itemDefId)) return false;
  const { slots } = sim.getStateOf(inventorySlice);
  if (slots.includes(itemDefId)) return true;
  const emptySlot = slots.indexOf(null);
  if (emptySlot === -1) return false;
  slots[emptySlot] = itemDefId;
  return true;
}
