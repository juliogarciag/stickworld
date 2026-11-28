import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { getAirplaneItemUse } from '../airplane';
import { getCraftingUse } from '../crafting';
import { isReadingLetter } from '../letter';
import { isFlagReached } from '../flag';
import { isPlayerStruck } from '../player/body';
import { getSpearUse } from '../spear';

/**
 * Using the held item: one command, `'item/use'`, whose meaning depends on
 * the item. This feature owns the command and decides nothing about items
 * itself: it asks each feature that has a use for an item, in order, and the
 * first that answers is what the command does (ADR 0003). A feature with a
 * new use for an item exports an answer and adds it to `ANSWERS`. An answer
 * may also say how to switch to another use of the same item (`switchUse`),
 * which `'item/switchUse'` performs (ADR 0009).
 */
export const itemFeature: Feature = {
  name: 'item',

  handleCommand(sim, command) {
    if (command.type === 'item/use') {
      getItemUseNow(sim)?.perform();
    }
    if (command.type === 'item/switchUse') {
      findItemUseSwitch(sim)?.();
    }
  },
};

/**
 * What `'item/use'` would do right now, with the function that does it, or undefined when it would
 * do nothing.
 */
export function getItemUseNow(sim: Sim): ItemUse | undefined {
  // A letter the stick man reads fills the stick man's hands: it is put away by interacting, and
  // until then no item is used. Struck down, the stick man does nothing at all.
  const areHandsBusy = isFlagReached(sim) || isReadingLetter(sim) || isPlayerStruck(sim);
  if (areHandsBusy) {
    return undefined;
  }
  for (const answer of ANSWERS) {
    const use = answer(sim);
    if (use) {
      return use;
    }
  }
  return undefined;
}

/**
 * The function that switches what `'item/use'` would do right now to the item's next use, or
 * undefined when the item has no other use, or none at all: an answer says so with `switchUse`.
 */
export function findItemUseSwitch(sim: Sim): (() => void) | undefined {
  const use = getItemUseNow(sim);
  const hasSwitch = use !== undefined && 'switchUse' in use;
  return hasSwitch ? use.switchUse : undefined;
}

/**
 * Every use an item has. No item is answered for by two of these yet, so the order decides
 * nothing so far; the two things the paper is made into are one answer, crafting's.
 */
const ANSWERS = [getCraftingUse, getAirplaneItemUse, getSpearUse] as const;

export type ItemUse = NonNullable<ReturnType<(typeof ANSWERS)[number]>>;

/**
 * What using the held item means: make the recipe the stick man knows for it, put the airplane on
 * the floor, or thrust the spear.
 */
export type ItemUseMeaning = ItemUse['means'];
