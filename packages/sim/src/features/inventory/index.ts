import type { Feature } from '../../core/feature';
import { isFlagReached } from '../flag';
import { giveItem } from './give';
import { inventorySlice } from './state';

/**
 * What the stick man holds: numbered item slots, one of which can be
 * selected. Reaching the flag of a level whose data names an item
 * (`flagGivesItem`) gives the stick man that item. Other features hand out items
 * through `giveItem` (give.ts).
 */
export const inventoryFeature: Feature = {
  name: 'inventory',
  slices: [inventorySlice],

  handleCommand(sim, command) {
    if (command.type !== 'inventory/select') return;
    const { slot } = command as { slot?: unknown };
    const inventory = sim.getStateOf(inventorySlice);
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1 || slot > inventory.slots.length) return;
    inventory.selectedSlot = inventory.selectedSlot === slot ? null : slot;
  },

  update(sim) {
    const { flagGivesItem } = sim.levelDef;
        // Asked every tick the flag stands reached: an item the stick man already holds is not given twice. With every slot taken the
    // item is not given at all; no level can do that yet, and the one that can has to say what happens to it.
    if (flagGivesItem !== undefined && isFlagReached(sim)) giveItem(sim, flagGivesItem);
  },
};
