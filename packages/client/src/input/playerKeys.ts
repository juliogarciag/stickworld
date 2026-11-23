import Phaser from 'phaser';
import type { KeysNow } from './playerCommands';

/**
 * The keys the player uses: left and right arrows or A and D to walk; up
 * arrow, W or space to jump. This is the only file that knows which keys
 * those are. Returns a function to call once a frame.
 */
export function watchPlayerKeys(scene: Phaser.Scene): () => KeysNow {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return () => ({ leftHeld: false, rightHeld: false, jumpPressed: false });
  const { KeyCodes } = Phaser.Input.Keyboard;
  const left = [keyboard.addKey(KeyCodes.LEFT), keyboard.addKey(KeyCodes.A)];
  const right = [keyboard.addKey(KeyCodes.RIGHT), keyboard.addKey(KeyCodes.D)];
  const jump = [keyboard.addKey(KeyCodes.UP), keyboard.addKey(KeyCodes.W), keyboard.addKey(KeyCodes.SPACE)];

  // Noted as it goes down, not looked at once a frame: a tap that is over within one frame is still a jump.
  // A repeat is not a press: Phaser forgets held keys when the window loses focus, and a key still held
  // when it comes back would otherwise jump by itself.
  let jumpPressed = false;
  for (const key of jump) {
    key.on('down', (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      if (!event.repeat) jumpPressed = true;
    });
  }
  return () => {
    const now = { leftHeld: left.some((key) => key.isDown), rightHeld: right.some((key) => key.isDown), jumpPressed };
    jumpPressed = false;
    return now;
  };
}
