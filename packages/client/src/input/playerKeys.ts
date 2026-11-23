import type Phaser from 'phaser';
import type { KeysNow } from './playerCommands';

/**
 * The keys the player uses: left and right arrows to walk, up arrow or space
 * to jump. This is the only file that knows which keys those are. Returns a
 * function to call once a frame.
 */
export function watchPlayerKeys(scene: Phaser.Scene): () => KeysNow {
  const keys = scene.input.keyboard?.createCursorKeys();
  // Noted as it goes down, not looked at once a frame: a tap that is over within one frame is still a jump.
  // A repeat is not a press: Phaser forgets held keys when the window loses focus, and a key still held
  // when it comes back would otherwise jump by itself.
  let jumpPressed = false;
  for (const key of keys ? [keys.up, keys.space] : []) {
    key.on('down', (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
      if (!event.repeat) jumpPressed = true;
    });
  }
  return () => {
    const now = { leftHeld: keys?.left.isDown ?? false, rightHeld: keys?.right.isDown ?? false, jumpPressed };
    jumpPressed = false;
    return now;
  };
}
