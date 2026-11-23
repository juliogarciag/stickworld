import type { Sim } from '../../core/sim';
import { isItemDefId } from './defs';
import { inventorySlice } from './state';

/**
 * What he holds, for the features whose rules depend on it or change it: a
 * recipe turns the item in the selected slot into another, placing an
 * airplane empties the slot.
 */

/** The def id of the item in the selected slot, or null when no slot is selected or the selected one is empty. */
export function selectedItemOf(sim: Sim): number | null {
  const { slots, selectedSlot } = sim.stateOf(inventorySlice);
  return selectedSlot === null ? null : (slots[selectedSlot - 1] ?? null);
}

/** True when one of his slots holds the item `itemDefId`. */
export function holdsItem(sim: Sim, itemDefId: number): boolean {
  return sim.stateOf(inventorySlice).slots.includes(itemDefId);
}

/**
 * Puts the item `itemDefId` in the selected slot in place of what it holds, or empties the slot for null, and says
 * whether it did. With no slot selected, or for an id that is not an item's, nothing changes.
 */
export function replaceSelectedItem(sim: Sim, itemDefId: number | null): boolean {
  const { slots, selectedSlot } = sim.stateOf(inventorySlice);
  if (selectedSlot === null || (itemDefId !== null && !isItemDefId(itemDefId))) return false;
  slots[selectedSlot - 1] = itemDefId;
  return true;
}
