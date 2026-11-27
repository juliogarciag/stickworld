/**
 * Interacts with what is next to him. What that does depends on what is
 * there and on what he is doing: read the letter, lift the airplane, put it
 * down. `getInteractionNow` (index.ts) says which.
 */
export interface WorldInteractCommand {
  readonly type: 'world/interact';
}

export type WorldCommand = WorldInteractCommand;
