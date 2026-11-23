/**
 * Uses the item in the selected slot. What that does depends on the item and
 * on what he is doing: the paper opens the recipe list, the airplane is put
 * on the floor. `itemUseNow` (index.ts) says which.
 */
export interface ItemUseCommand {
  readonly type: 'item/use';
}

export type ItemCommand = ItemUseCommand;
