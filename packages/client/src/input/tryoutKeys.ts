import type Phaser from 'phaser';

/**
 * TRYOUT (#44, comes out before merge): the keys of a dev build that try the ways the club enemy
 * may die. T tries the next way; R brings the enemy back, the stick man with the spear in its hand.
 */
export const TRYOUT_KEY_NAMES = { nextEnemyDeath: 'T', playAgain: 'R' } as const;

/** Calls `tryout.selectNext` and `tryout.playAgain` each time their key goes down in `scene`. */
export function watchTryoutKeys(
  scene: Phaser.Scene,
  tryout: { selectNext: () => void; playAgain: () => void },
): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    return;
  }
  keyboard.on(`keydown-${TRYOUT_KEY_NAMES.nextEnemyDeath}`, (event: KeyboardEvent) => {
    if (!event.repeat) {
      tryout.selectNext();
    }
  });
  keyboard.on(`keydown-${TRYOUT_KEY_NAMES.playAgain}`, (event: KeyboardEvent) => {
    if (!event.repeat) {
      tryout.playAgain();
    }
  });
}
