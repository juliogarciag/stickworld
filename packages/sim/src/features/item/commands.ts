/**
 * Uses the item in the selected slot. What that does depends on the item and
 * on what the stick man knows: the paper is folded into what the stick man has learned to make of
 * it, the airplane is put on the floor, the spear is thrust. `getItemUseNow` (index.ts) says which.
 */
export interface ItemUseCommand {
  readonly type: 'item/use';
}

/**
 * Switches what using the held item does, when it has more than one use: the paper is made into
 * the next thing the stick man knows how to make of it. Nothing happens for an item with one use
 * or none, and while its hands are busy.
 */
export interface ItemSwitchUseCommand {
  readonly type: 'item/switchUse';
}

export type ItemCommand = ItemUseCommand | ItemSwitchUseCommand;
