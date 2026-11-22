import type { Command, Def, Level, SimHandle, SimSnapshot } from '@stickworld/sim';
import { defs, hashSnapshot, levelOf } from '@stickworld/sim';
import type Phaser from 'phaser';
import type { WalkDemo } from './demo/walkAlongTheFloor';
import type { GameLoop } from './loop/GameLoop';
import { PIXELS_PER_METRE } from './render/units';
import type { LevelScene } from './scenes/LevelScene';

/** What dev tooling and end-to-end checks can reach from the page. Dev builds only; listed in AGENTS.md. */
export interface GameDebugApi {
  /** The sim being played. A new object after `loadLevel`. */
  readonly sim: SimHandle;
  readonly game: Phaser.Game;
  /** The level being played, as its data file has it. */
  readonly level: Level;
  readonly defs: readonly Def[];
  readonly pixelsPerMetre: number;
  snapshot(): SimSnapshot;
  hash(): string;
  /** The level camera right now, or undefined until the level scene runs. */
  camera(): CameraView | undefined;
  /** Look test only (issue #1): the stick man's client-only walk, or undefined until the level scene has drawn. `pose()` reads it, `setPaused(true)` holds him still. Goes away with the demo. */
  walkDemo(): WalkDemo | undefined;
  /** Queues a command for the next earned tick, through the same path as keyboard input. */
  queueCommand(command: Command): void;
  /** Plays level `level` from its start. */
  loadLevel(level: number): void;
}

/** The camera as a check needs it: zoom, where it looks, and how big the view is in screen pixels. */
export interface CameraView {
  readonly zoom: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
}

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}

export function exposeDebugApi({ loop, game }: { loop: GameLoop; game: Phaser.Game }): void {
  window.__game = {
    get sim() {
      return loop.sim;
    },
    game,
    get level() {
      return levelOf(loop.sim);
    },
    defs,
    pixelsPerMetre: PIXELS_PER_METRE,
    snapshot: () => loop.sim.snapshot(),
    hash: () => hashSnapshot(loop.sim.snapshot()),
    camera: () => {
      if (!game.scene.isActive('level')) return undefined;
      const { zoom, scrollX, scrollY, width, height } = game.scene.getScene('level').cameras.main;
      return { zoom, scrollX, scrollY, width, height };
    },
    walkDemo: () => (game.scene.isActive('level') ? (game.scene.getScene('level') as LevelScene).walkDemo : undefined),
    queueCommand: (command) => loop.queueCommand(command),
    loadLevel: (level) => loop.playLevel(level),
  };
}
