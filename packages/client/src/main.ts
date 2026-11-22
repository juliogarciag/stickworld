import Phaser from 'phaser';
import { createSim } from '@stickworld/sim';
import { exposeDebugApi } from './debug';
import { GameLoop } from './loop/GameLoop';
import { PAPER_COLOUR } from './render/paper';
import { keepCanvasAtWindowSize, windowViewportConfig } from './render/viewport';
import { LevelScene } from './scenes/LevelScene';
import { startingLevel } from './startingLevel';

/** Boots the game: a sim on the first level (or `VITE_LEVEL` in dev), and the Phaser view of it. */
function boot(): void {
  const level = import.meta.env.DEV ? startingLevel(import.meta.env.VITE_LEVEL) : startingLevel(undefined);
  const loop = new GameLoop(createSim({ level, seed: 1 }));
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: PAPER_COLOUR,
    scene: [new LevelScene(loop)],
    scale: windowViewportConfig(),
  });
  keepCanvasAtWindowSize(game);
  if (import.meta.env.DEV) exposeDebugApi({ loop, game });
}

boot();
