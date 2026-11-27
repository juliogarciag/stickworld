import Phaser from 'phaser';
import type { KeysNow } from './playerCommands';

/**
 * The keys the player uses: left and right arrows or A and D to walk; up
 * arrow, W or space to jump; seated in the airplane, up arrow or W and down
 * arrow or S to steer it, and space to jump out. This is the only file that
 * knows which keys those are; `MOVE_KEY_NAMES` and `FLIGHT_KEY_NAMES` are
 * how they are named to the player. Returns a function to call once a frame.
 */
export function watchPlayerKeys(scene: Phaser.Scene): () => KeysNow {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return () => ({ leftHeld: false, rightHeld: false, upHeld: false, downHeld: false, jumpHeld: false, jumpPressed: false, upPressed: false });
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
  const recordPresses = (keys: Phaser.Input.Keyboard.Key[], which: keyof typeof pressed): void => {
    for (const key of keys) {
      key.on('down', (_key: Phaser.Input.Keyboard.Key, event: KeyboardEvent) => {
        if (!event.repeat) pressed[which] = true;
      });
    }
  };
  recordPresses(jump, 'jump');
  recordPresses(up, 'up');
  const isAnyDown = (keys: Phaser.Input.Keyboard.Key[]): boolean => keys.some((key) => key.isDown);
  return () => {
    const now = { leftHeld: isAnyDown(left), rightHeld: isAnyDown(right), upHeld: isAnyDown(up), downHeld: isAnyDown(down), jumpHeld: isAnyDown(jump), jumpPressed: pressed.jump, upPressed: pressed.up };
    pressed.jump = false;
    pressed.up = false;
    return now;
  };
}

/** The keys that move him on his feet, as the player knows them: what a note on the sheet draws beside its words. */
export const MOVE_KEY_NAMES = { walking: ['←', '→'], jumping: ['↑'] } as const;

/** The keys that fly the airplane, as the player knows them. */
export const FLIGHT_KEY_NAMES = { climb: '↑', dive: '↓', jumpOut: 'SPACE' } as const;
