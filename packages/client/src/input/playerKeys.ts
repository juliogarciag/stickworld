import Phaser from 'phaser';
import type { KeysNow } from './playerCommands';

/**
 * The keys the player uses: left and right arrows or A and D to walk; up
 * arrow, W or space to jump; seated in the airplane, up arrow or W and down
 * arrow or S to steer it, and space to jump out. This is the only file that
 * knows which keys those are; `FLIGHT_KEY_NAMES` is how the HUD names the
 * flying ones to the player. Returns a function to call once a frame.
 */
export function watchPlayerKeys(scene: Phaser.Scene): () => KeysNow {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return () => ({ leftHeld: false, rightHeld: false, upHeld: false, downHeld: false, jumpPressed: false, upPressed: false });
  const { KeyCodes } = Phaser.Input.Keyboard;
  const left = [keyboard.addKey(KeyCodes.LEFT), keyboard.addKey(KeyCodes.A)];
  const right = [keyboard.addKey(KeyCodes.RIGHT), keyboard.addKey(KeyCodes.D)];
  const up = [keyboard.addKey(KeyCodes.UP), keyboard.addKey(KeyCodes.W)];
  const down = [keyboard.addKey(KeyCodes.DOWN), keyboard.addKey(KeyCodes.S)];
  const jump = [keyboard.addKey(KeyCodes.SPACE)];

  // Noted as it goes down, not looked at once a frame: a tap that is over within one frame is still a jump.
  // A repeat is not a press: Phaser forgets held keys when the window loses focus, and a key still held
  // when it comes back would otherwise jump by itself.
  const pressed = { jump: false, up: false };
  const notePresses = (keys: Phaser.Input.Keyboard.Key[], which: keyof typeof pressed): void => {
    for (const key of keys) {
      key.on('down', (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
        if (!event.repeat) pressed[which] = true;
      });
    }
  };
  notePresses(jump, 'jump');
  notePresses(up, 'up');
  const anyIsDown = (keys: Phaser.Input.Keyboard.Key[]): boolean => keys.some((key) => key.isDown);
  return () => {
    const now = { leftHeld: anyIsDown(left), rightHeld: anyIsDown(right), upHeld: anyIsDown(up), downHeld: anyIsDown(down), jumpPressed: pressed.jump, upPressed: pressed.up };
    pressed.jump = false;
    pressed.up = false;
    return now;
  };
}

/** The keys that fly the airplane, as the player knows them. */
export const FLIGHT_KEY_NAMES = { climb: '↑', dive: '↓', jumpOut: 'SPACE' } as const;
