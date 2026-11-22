import type Phaser from 'phaser';

/**
 * LOOK TEST ONLY (issue #1), with `demo/walkAlongTheFloor.ts`. The Level 1
 * ticket (issue #2) replaces this with the mapping from keys to commands.
 */

/** Which way the arrow keys say to walk right now: -1 left, 1 right, 0 neither (or both). */
export type HeldDirection = -1 | 0 | 1;

/** Reads the left and right arrow keys of `scene`. Returns a function that says which way is held. */
export function watchWalkKeys(scene: Phaser.Scene): () => HeldDirection {
  const keys = scene.input.keyboard?.createCursorKeys();
  return () => {
    if (!keys) return 0;
    if (keys.left.isDown === keys.right.isDown) return 0;
    return keys.left.isDown ? -1 : 1;
  };
}
