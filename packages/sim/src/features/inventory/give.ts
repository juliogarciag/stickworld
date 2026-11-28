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
  if (!isItemDefId(itemDefId)) {
    return false;
  }
  const { slots } = sim.getStateOf(inventorySlice);
  if (slots.includes(itemDefId)) {
    return true;
  }
  const emptySlot = slots.indexOf(null);
  if (emptySlot === -1) {
    return false;
  }
  slots[emptySlot] = itemDefId;
  return true;
}

/**
 * Puts the item `itemDefId` in the stick man's hand whatever it holds: in the first empty slot, or,
 * with every slot taken, in place of the item in the selected slot (the first slot when none is
 * selected), which is gone. The slot it ends up in is selected. False, and nothing changes, only
 * for an id that is not an item's. For what the stick man cannot go on without (the item a letter
 * gives): one slot is all there is, and a letter is read once.
 */
export function giveItemInHand(sim: Sim, itemDefId: number): boolean {
  if (!isItemDefId(itemDefId)) {
    return false;
  }
  const inventory = sim.getStateOf(inventorySlice);
  if (!giveItem(sim, itemDefId)) {
    inventory.slots[(inventory.selectedSlot ?? 1) - 1] = itemDefId;
  }
  inventory.selectedSlot = inventory.slots.indexOf(itemDefId) + 1;
  return true;
}
