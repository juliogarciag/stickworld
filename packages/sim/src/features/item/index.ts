import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { airplaneItemUse } from '../airplane';
import { recipeListUse } from '../crafting';
import { letterBeingRead } from '../letter';
import { hasFinishedLevel } from '../player';

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
  if (hasFinishedLevel(sim)) return undefined;
  for (const answer of ANSWERS) {
    const use = answer(sim);
    if (use) return use;
  }
  return undefined;
}

/** Every use an item has, most pressing first: a letter he reads is put away before anything else starts. */
const ANSWERS = [letterBeingRead, recipeListUse, airplaneItemUse] as const;

export type ItemUse = NonNullable<ReturnType<(typeof ANSWERS)[number]>>;

/** What using the held item means: put away the letter he reads, open the recipe list, make the listed recipe, close a list with nothing to make, or put the airplane on the floor. */
export type ItemUseMeaning = ItemUse['means'];
