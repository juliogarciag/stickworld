import { BOARDING, type Command } from '@stickworld/sim';
import type Phaser from 'phaser';

/**
 * The keys for what he does with things: J uses the held item, K interacts
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
  if (BOARDING.needsAHeldPress) sendShortAndHeldPresses(scene, send);
  else {
    keyboard.on(`keydown-${ACTION_KEY_NAMES.interact}`, (event: KeyboardEvent) => {
      if (!event.repeat) send({ type: 'world/interact' });
    });
  }
}

// ---- Helpers ----

/**
 * The interact key when a held press means something else than a short one: a short press is sent when the key comes
 * up, since only then is it known to be short, and a held one as soon as it has lasted long enough.
 */
function sendShortAndHeldPresses(scene: Phaser.Scene, send: (command: Command) => void): void {
  let pressWaiting: Phaser.Time.TimerEvent | undefined;
  scene.input.keyboard?.on(`keydown-${ACTION_KEY_NAMES.interact}`, (event: KeyboardEvent) => {
    if (event.repeat || pressWaiting) return;
    pressWaiting = scene.time.delayedCall(BOARDING.heldPressSeconds * 1000, () => {
      pressWaiting = undefined;
      send({ type: 'world/interact', held: true });
    });
  });
  scene.input.keyboard?.on(`keyup-${ACTION_KEY_NAMES.interact}`, () => {
    if (!pressWaiting) return;
    pressWaiting.remove();
    pressWaiting = undefined;
    send({ type: 'world/interact' });
  });
}
