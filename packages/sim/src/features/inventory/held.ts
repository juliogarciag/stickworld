import type { Sim } from '../../core/sim';
import { isItemDefId } from './defs';
import { inventorySlice } from './state';

/**
 * What he holds, for the features whose rules depend on it or change it: a
 * recipe turns the item in the selected slot into another, placing an
 * airplane empties the slot.
 */

/** The def id of the item in the selected slot, or null when no slot is selected or the selected one is empty. */
export function getSelectedItem(sim: Sim): number | null {
  const { slots, selectedSlot } = sim.getStateOf(inventorySlice);
  return selectedSlot === null ? null : (slots[selectedSlot - 1] ?? null);
}

/** True when one of his slots holds the item `itemDefId`. */
export function isHoldingItem(sim: Sim, itemDefId: number): boolean {
  return sim.getStateOf(inventorySlice).slots.includes(itemDefId);
}

/** Selects the slot that holds the item `itemDefId`, and says whether one does. Nothing changes when none does. */
export function selectItem(sim: Sim, itemDefId: number): boolean {
  const inventory = sim.getStateOf(inventorySlice);
  const index = inventory.slots.indexOf(itemDefId);
  if (index === -1) return false;
  inventory.selectedSlot = index + 1;
  return true;
}

/**
 * Puts the item `itemDefId` in the selected slot in place of what it holds, or empties the slot for null, and says
 * whether it did. With no slot selected, or for an id that is not an item's, nothing changes.
 */
export function replaceSelectedItem(sim: Sim, itemDefId: number | null): boolean {
  const { slots, selectedSlot } = sim.getStateOf(inventorySlice);
  if (selectedSlot === null || (itemDefId !== null && !isItemDefId(itemDefId))) return false;
  slots[selectedSlot - 1] = itemDefId;
  return true;
}
