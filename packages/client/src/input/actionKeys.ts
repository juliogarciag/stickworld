import type { Command } from '@stickworld/sim';
import type Phaser from 'phaser';

/**
 * The keys for what the stick man does with things: J uses the held item, K interacts with the
 * world, L switches what the held item is used for when it has more than one use. This is the only
 * file that knows which keys those are; `ACTION_KEY_NAMES` is how the HUD names them to the player.
 */
export const ACTION_KEY_NAMES = { useItem: 'J', interact: 'K', switchItemUse: 'L' } as const;

/**
 * Hands `send` an 'item/use' each time the use key goes down in `scene`, an 'item/switchUse' for
 * each press of the switch key and a 'world/interact' for each press of the interact key. A key
 * held down counts once.
 */
export function sendActionCommands(scene: Phaser.Scene, send: (command: Command) => void): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    return;
  }
  keyboard.on(`keydown-${ACTION_KEY_NAMES.useItem}`, (event: KeyboardEvent) => {
    if (!event.repeat) {
      send({ type: 'item/use' });
    }
  });
  keyboard.on(`keydown-${ACTION_KEY_NAMES.switchItemUse}`, (event: KeyboardEvent) => {
    if (!event.repeat) {
      send({ type: 'item/switchUse' });
    }
  });
  keyboard.on(`keydown-${ACTION_KEY_NAMES.interact}`, (event: KeyboardEvent) => {
    if (!event.repeat) {
      send({ type: 'world/interact' });
    }
  });
}
