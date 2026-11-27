import type { Command } from '@stickworld/sim';
import type Phaser from 'phaser';

/** Which item slot each key means, by Phaser's name for the key. */
const SLOT_OF_KEY: Readonly<Record<string, number>> = { ONE: 1, NUMPAD_ONE: 1 };

/**
 * Hands `send` an 'inventory/select' for a slot each time that slot's key goes down in `scene`. A
 * key held down counts once.
 */
export function sendItemSlotCommands(scene: Phaser.Scene, send: (command: Command) => void): void {
  for (const [key, slot] of Object.entries(SLOT_OF_KEY)) {
    scene.input.keyboard?.on(`keydown-${key}`, (event: KeyboardEvent) => {
      if (!event.repeat) {
        send({ type: 'inventory/select', slot });
      }
    });
  }
}
