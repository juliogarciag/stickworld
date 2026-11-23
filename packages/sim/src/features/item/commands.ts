/**
 * Uses the item in the selected slot. What that does depends on the item and
 * on what he knows: the paper is folded into what he has learned to make of
 * it, the airplane is put on the floor. `itemUseNow` (index.ts) says which.
 */
export interface ItemUseCommand {
  readonly type: 'item/use';
}

export type ItemCommand = ItemUseCommand;
