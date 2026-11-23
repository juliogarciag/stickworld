import type { Def } from '../../content/defs';

/**
 * The items the stick man can hold, and how many slots he has for them.
 * Ids 200-299 are this feature's block in content/defs.ts.
 */

/** The sheet of paper level 2's flag gives. He keeps it from then on. */
export const PAPER_ITEM_ID = 200;

/** How many item slots he has. The player counts them from 1. */
export const ITEM_SLOT_COUNT = 1;

export const itemDefs: readonly Def[] = [{ id: PAPER_ITEM_ID, name: 'paper' }];

/** True when `defId` is the id of an item, the only kind of thing a slot can hold. */
export function isItemDefId(defId: number): boolean {
  return itemDefs.some((def) => def.id === defId);
}
