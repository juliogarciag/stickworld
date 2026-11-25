import Phaser from 'phaser';
import { createSim } from '@stickworld/sim';
import { exposeDebugApi } from './debug';
import { GameLoop } from './loop/GameLoop';
import { createPageTurn } from './render/pageTurn';
import { PAPER_COLOUR } from './render/paper';
import { keepCanvasAtWindowSize, windowViewportConfig } from './render/viewport';
import { HudScene } from './scenes/HudScene';
import { LevelScene } from './scenes/LevelScene';
import { TurnedSheetScene } from './scenes/TurnedSheetScene';
import { startingLevel } from './startingLevel';

/** Boots the game: a sim on the first level (or `VITE_LEVEL` in dev), and the Phaser view of it. */
function boot(): void {
  const level = import.meta.env.DEV ? startingLevel(import.meta.env.VITE_LEVEL) : startingLevel(undefined);
  const loop = new GameLoop(createSim({ level, seed: 1 }));
  const pageTurn = createPageTurn();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: PAPER_COLOUR,
    // In the order they are drawn: the level, over it the sheet that is being turned away, over both what is not on the paper.
    scene: [new LevelScene(loop, pageTurn), new TurnedSheetScene(pageTurn), new HudScene(loop, pageTurn)],
    scale: windowViewportConfig(),
  });
  keepCanvasAtWindowSize(game);
  if (import.meta.env.DEV) {
    exposeDebugApi({ loop, game, pageTurn });
    // Loaded only here, so that a production build has neither the panel nor the library that draws it.
    void import('./movementPanel').then(({ showMovementPanel }) => showMovementPanel(loop));
  }
}

boot();
