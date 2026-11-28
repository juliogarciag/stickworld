import type Phaser from 'phaser';

/**
 * TRYOUT (#44, comes out before merge): the keys of a dev build that try what becomes of the
 * halves of a torn enemy. T tries the next way; R brings every enemy back, the stick man with the
 * spear in its hand, and leaves what lies on the sheet; C clears what lies on the sheet.
 */
export const TRYOUT_KEY_NAMES = { nextWay: 'T', playAgain: 'R', clear: 'C' } as const;

/** Calls `tryout.selectNext`, `tryout.playAgain` and `tryout.clear` as their keys go down. */
export function watchTryoutKeys(
  scene: Phaser.Scene,
  tryout: { selectNext: () => void; playAgain: () => void; clear: () => void },
): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    return;
  }
  const keys = [
    [TRYOUT_KEY_NAMES.nextWay, tryout.selectNext],
    [TRYOUT_KEY_NAMES.playAgain, tryout.playAgain],
    [TRYOUT_KEY_NAMES.clear, tryout.clear],
  ] as const;
  for (const [key, act] of keys) {
    keyboard.on(`keydown-${key}`, (event: KeyboardEvent) => {
      if (!event.repeat) {
        act();
      }
    });
  }
}
