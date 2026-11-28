/**
 * Uses the item in the selected slot. What that does depends on the item and
 * on what the stick man knows: the paper is folded into what the stick man has learned to make of
 * it, the airplane is put on the floor, the spear is thrust. `getItemUseNow` (index.ts) says which.
 */
export interface ItemUseCommand {
  readonly type: 'item/use';
}

export type ItemCommand = ItemUseCommand;
