import type { Command, Def, FlagView, Level, SimHandle, SimSnapshot, StickManView } from '@stickworld/sim';
import { defs, flagOf, hashSnapshot, levelOf, STICK_MAN_HEIGHT, stickManOf } from '@stickworld/sim';
import type Phaser from 'phaser';
import type { GameLoop } from './loop/GameLoop';
import { PIXELS_PER_METRE } from './render/units';

/** What dev tooling and end-to-end checks can reach from the page. Dev builds only; listed in AGENTS.md. */
export interface GameDebugApi {
  /** The sim being played. A new object after `loadLevel`. */
  readonly sim: SimHandle;
  readonly game: Phaser.Game;
  /** The level being played, as its data file has it. */
  readonly level: Level;
  readonly defs: readonly Def[];
  readonly pixelsPerMetre: number;
  /** The stick man's height in metres, as the sim's tuning has it. */
  readonly stickManHeight: number;
  snapshot(): SimSnapshot;
  hash(): string;
  /** The level camera right now, or undefined until the level scene runs. */
  camera(): CameraView | undefined;
  /** The stick man as the sim has him right now: where his feet are (metres) and what he is doing. */
  stickMan(): StickManView;
  /** The level's flag as the sim has it right now, or undefined when the level has none. */
  flag(): FlagView | undefined;
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
    stickManHeight: STICK_MAN_HEIGHT,
    snapshot: () => loop.sim.snapshot(),
    hash: () => hashSnapshot(loop.sim.snapshot()),
    camera: () => {
      if (!game.scene.isActive('level')) return undefined;
      const { zoom, scrollX, scrollY, width, height } = game.scene.getScene('level').cameras.main;
      return { zoom, scrollX, scrollY, width, height };
    },
    stickMan: () => stickManOf(loop.sim),
    flag: () => flagOf(loop.sim),
    queueCommand: (command) => loop.queueCommand(command),
    loadLevel: (level) => loop.playLevel(level),
  };
}
