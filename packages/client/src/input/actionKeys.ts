import type { Command } from '@stickworld/sim';
import type Phaser from 'phaser';

/**
 * The keys for what the stick man does with things: J uses the held item, K interacts
 * with the world. This is the only file that knows which keys those are;
 * `ACTION_KEY_NAMES` is how the HUD names them to the player.
 */
export const ACTION_KEY_NAMES = { useItem: 'J', interact: 'K' } as const;

/** Hands `send` an 'item/use' each time the use key goes down in `scene`, and a 'world/interact' for each press of the interact key. A key held down counts once. */
export function sendActionCommands(scene: Phaser.Scene, send: (command: Command) => void): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;
  keyboard.on(`keydown-${ACTION_KEY_NAMES.useItem}`, (event: KeyboardEvent) => {
    if (!event.repeat) send({ type: 'item/use' });
  });
  keyboard.on(`keydown-${ACTION_KEY_NAMES.interact}`, (event: KeyboardEvent) => {
    if (!event.repeat) send({ type: 'world/interact' });
  });
}
