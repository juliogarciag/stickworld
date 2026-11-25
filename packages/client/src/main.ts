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
    // The game has no sound, and making Phaser's audio context held up the first frame by about a quarter of a second
    // the first time a browser made one.
    // Take this out when the game gets sound.
    audio: { noAudio: true },
  });
  keepCanvasAtWindowSize(game);
  if (import.meta.env.DEV) exposeDebugApi({ loop, game, pageTurn });
}

boot();
