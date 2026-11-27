/**
 * Interacts with what is next to the stick man. What that does depends on what is
 * there and on what the stick man is doing: read the letter, lift the airplane, put it
 * down. `getInteractionNow` (index.ts) says which.
 */
export interface WorldInteractCommand {
  readonly type: 'world/interact';
}

export type WorldCommand = WorldInteractCommand;
