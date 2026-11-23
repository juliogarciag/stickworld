import type { Feature } from '../../core/feature';
import { inventorySlice } from './state';

/**
 * What the stick man holds: numbered item slots, one of which can be
 * selected. Items arrive through `giveItem` (give.ts), called by the feature
 * whose rule hands one out.
 */
export const inventoryFeature: Feature = {
  name: 'inventory',
  slices: [inventorySlice],
  handleCommand(sim, command) {
    if (command.type !== 'inventory/select') return;
    const { slot } = command as { slot?: unknown };
    const inventory = sim.stateOf(inventorySlice);
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1 || slot > inventory.slots.length) return;
    inventory.selectedSlot = inventory.selectedSlot === slot ? null : slot;
  },
};
