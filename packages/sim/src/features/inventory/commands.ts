/**
 * Selects item slot `slot`, or unselects it when it is the one already selected. Slots are counted
 * from 1, as the player counts them.
 */
export interface InventorySelectCommand {
  readonly type: 'inventory/select';
  readonly slot: number;
}

export type InventoryCommand = InventorySelectCommand;
