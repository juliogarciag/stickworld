import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { airplaneItemUse } from '../airplane';
import { craftingUse } from '../crafting';
import { isReadingALetter } from '../letter';
import { flagIsReached } from '../flag';

/**
 * Using the held item: one command, `'item/use'`, whose meaning depends on
 * the item. This feature owns the command and decides nothing about items
 * itself: it asks each feature that has a use for an item, in order, and the
 * first that answers is what the command does (ADR 0003). A feature with a
 * new use for an item exports an answer and adds it to `ANSWERS`.
 */
export const itemFeature: Feature = {
  name: 'item',

  handleCommand(sim, command) {
    if (command.type !== 'item/use') return;
    itemUseNow(sim)?.perform();
  },
};

/** What `'item/use'` would do right now, with the function that does it, or undefined when it would do nothing. */
export function itemUseNow(sim: Sim): ItemUse | undefined {
  // A letter he reads fills his hands: it is put away by interacting, and until then no item is used.
  if (flagIsReached(sim) || isReadingALetter(sim)) return undefined;
  for (const answer of ANSWERS) {
    const use = answer(sim);
    if (use) return use;
  }
  return undefined;
}

/** Every use an item has. No item has two yet, so the order decides nothing so far. */
const ANSWERS = [craftingUse, airplaneItemUse] as const;

export type ItemUse = NonNullable<ReturnType<(typeof ANSWERS)[number]>>;

/** What using the held item means: make the recipe he knows for it, or put the airplane on the floor. */
export type ItemUseMeaning = ItemUse['means'];
