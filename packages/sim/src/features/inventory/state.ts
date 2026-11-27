import { defineSlice } from '../../core/slice';
import { ITEM_SLOT_COUNT } from './defs';

export interface Inventory {
  /** What each slot holds: an item's def id, or null when it is empty. Slot 1 is `slots[0]`. */
  slots: (number | null)[];
  /**
   * The number of the selected slot, counted from 1 as the player counts them, or null when none
   * is.
   */
  selectedSlot: number | null;
}

/**
 * What the stick man holds. It carries across levels, so starting the next
 * level and restarting one after a death both keep it: the paper from level 2
 * is never lost.
 */
export const inventorySlice = defineSlice<Inventory>(
  'inventory',
  () => ({ slots: Array.from({ length: ITEM_SLOT_COUNT }, () => null), selectedSlot: null }),
  {
    isCarriedAcrossLevels: true,
  },
);
