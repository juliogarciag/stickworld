import type { SimHandle } from '../../core/sim';
import { inventorySlice, type Inventory } from './state';

/** One item slot as a view shows it. */
export interface ItemSlot {
  /** The slot's number, counted from 1 as the player counts them. */
  readonly slot: number;
  /** The def id of the item in the slot, or null when it is empty. */
  readonly itemDefId: number | null;
  readonly selected: boolean;
}

/** Every item slot the stick man has, in order, with what it holds and whether it is selected. */
export function itemSlotsOf(sim: SimHandle): ItemSlot[] {
  const inventory = sim.snapshot().slices[inventorySlice.key] as Inventory | undefined;
  if (!inventory) return [];
  return inventory.slots.map((itemDefId, index) => ({ slot: index + 1, itemDefId, selected: inventory.selectedSlot === index + 1 }));
}
