import type { Command } from '@stickworld/sim';
import type Phaser from 'phaser';

/**
 * The keys for the game as a whole: Enter plays it again once it is over.
 * This is the only file that knows which key that is; `GAME_KEY_NAMES` is
 * how the HUD names it to the player.
 */
export const GAME_KEY_NAMES = { playAgain: 'ENTER' } as const;

/**
 * Hands `send` a 'game/playAgain' each time the play again key goes down in `scene`. A key held
 * down counts once. Whether the game can be played again right now is the sim's business: it
 * ignores the command until it can.
 */
export function sendGameCommands(scene: Phaser.Scene, send: (command: Command) => void): void {
  scene.input.keyboard?.on(`keydown-${GAME_KEY_NAMES.playAgain}`, (event: KeyboardEvent) => {
    if (!event.repeat) {
      send({ type: 'game/playAgain' });
    }
  });
}
