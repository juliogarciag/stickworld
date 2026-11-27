import Phaser from 'phaser';
import { createSim } from '@stickworld/sim';
import { exposeDebugApi } from './debug';
import { GameLoop } from './loop/GameLoop';
import { createPageTurn } from './render/pageTurn';
import { PAPER_COLOUR } from './render/paper';
import { keepCanvasAtWindowSize, getWindowViewportConfig } from './render/viewport';
import { HudScene } from './scenes/HudScene';
import { LevelScene } from './scenes/LevelScene';
import { TurnedSheetScene } from './scenes/TurnedSheetScene';
import { getStartingLevel } from './startingLevel';

/** Boots the game: a sim on the first level (or `VITE_LEVEL` in dev), and the Phaser view of it. */
function boot(): void {
  const level = import.meta.env.DEV
    ? getStartingLevel(import.meta.env.VITE_LEVEL)
    : getStartingLevel(undefined);
  const loop = new GameLoop(createSim({ level, seed: 1 }));
  const pageTurn = createPageTurn();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: PAPER_COLOUR,
    // In the order they are drawn: the level, over it the sheet that is being turned away, over
    // both what is not on the paper.
    scene: [
      new LevelScene(loop, pageTurn),
      new TurnedSheetScene(pageTurn),
      new HudScene(loop, pageTurn),
    ],
    scale: getWindowViewportConfig(),
    // The game has no sound, and making Phaser's audio context held up the first frame by about a
    // quarter of a second the first time a browser made one. Take this out when the game gets
    // sound.
    audio: { noAudio: true },
    // A frame's time reaches the loop as it was. Phaser would otherwise average it over the last
    // frames and, for the 120 frames after a start, a show or a focus, and for as long as the
    // window is not focused, cut it to a sixtieth of a second: a longer frame then gave the sim
    // less time than had passed, and the game ran in slow motion. `loop/frameSeconds.ts` has the
    // one cap that is left.
    fps: { smoothStep: false },
  });
  keepCanvasAtWindowSize(game);
  if (import.meta.env.DEV) {
    exposeDebugApi({ loop, game, pageTurn });
    // Loaded only here, so that a production build has neither the panel nor the library that draws
    // it.
    void import('./movementPanel').then((movementPanel) => movementPanel.showMovementPanel(loop));
  }
}

boot();
