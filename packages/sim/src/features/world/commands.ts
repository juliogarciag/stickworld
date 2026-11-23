/**
 * Interacts with what is next to him. What that does depends on what is
 * there and on what he is doing: read the letter, lift the airplane, put it
 * down. `interactionNow` (index.ts) says which.
 */
export interface WorldInteractCommand {
  readonly type: 'world/interact';
  /** True for a press the player held down, when a held press means something else than a short one (`BOARDING.needsAHeldPress`). Left out, it is a short press. */
  readonly held?: boolean;
}

export type WorldCommand = WorldInteractCommand;
