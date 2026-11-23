import type { InventoryCommand } from '../features/inventory/commands';
import type { PlayerCommand } from '../features/player/commands';

/**
 * Commands are the only way input reaches the sim. They are plain,
 * serializable objects (JSON-safe) so they can be recorded and replayed: a
 * level test is a list of commands that reaches the flag.
 *
 * Each feature declares its own command types in features/<feature>/commands.ts
 * and handles them in its Feature.handleCommand. The `type` literal is
 * namespaced as '<feature>/<verb>' and says what the player means, never
 * which key was pressed. Add the feature's union here, one per line:
 *
 *   export type Command =
 *     | PlayerCommand
 *     | InventoryCommand;
 */
export type Command = PlayerCommand | InventoryCommand;

/** True when `value` has the minimal shape of a command. Anything else is dropped by Sim.step. */
export function isCommandShaped(value: unknown): value is Command {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}
