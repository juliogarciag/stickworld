import type { Feature } from '../../core/feature';
import { flagSlice } from '../flag/state';
import { giveItem } from './give';
import { inventorySlice } from './state';

/**
 * What the stick man holds: numbered item slots, one of which can be
 * selected. Reaching the flag of a level whose data names an item
 * (`flagGivesItem`) gives him that item. Other features hand out items
 * through `giveItem` (give.ts).
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

  update(sim) {
    const { flagGivesItem } = sim.levelDef;
    const flagReached = sim.stateOf(flagSlice).reachedAtTick !== null;
    // Asked every tick the flag stands reached: an item he already holds is not given twice.
    if (flagGivesItem !== undefined && flagReached) giveItem(sim, flagGivesItem);
  },
};
