import type { Command, Def, ItemSlot, Level, SimHandle, SimSnapshot } from '@stickworld/sim';
import { defs, hashSnapshot, itemSlotsOf, levelOf, STICK_MAN_HEIGHT } from '@stickworld/sim';
import type Phaser from 'phaser';
import type { WalkDemo } from './demo/walkAlongTheFloor';
import { itemSlotBox, type Rectangle } from './hud/itemSlots';
import type { GameLoop } from './loop/GameLoop';
import { worldSeenBy } from './render/cameraView';
import { PIXELS_PER_METRE } from './render/units';
import { HUD_SCENE } from './scenes/HudScene';
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
  /** The stick man's height in metres, as the sim's tuning has it. */
  readonly stickManHeight: number;
  snapshot(): SimSnapshot;
  hash(): string;
  /** The level camera right now, or undefined until the level scene runs. */
  camera(): CameraView | undefined;
  /** Look test only (issue #1): the stick man's client-only walk, or undefined until the level scene has drawn. `pose()` reads it, `setPaused(true)` holds him still. Goes away with the demo. */
  walkDemo(): WalkDemo | undefined;
  /** Every item slot as the sim has it, with where the HUD draws its box on the page, in CSS pixels. Empty until the HUD scene runs. */
  itemSlots(): ShownItemSlot[];
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

/** An item slot with the rectangle of the page its box is drawn in, in CSS pixels. */
export interface ShownItemSlot extends ItemSlot {
  readonly onPage: Rectangle;
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
    walkDemo: () => (game.scene.isActive('level') ? (game.scene.getScene('level') as LevelScene).walkDemo : undefined),
    itemSlots: () => {
      if (!game.scene.isActive(HUD_SCENE)) return [];
      const seen = worldSeenBy(game.scene.getScene(HUD_SCENE).cameras.main);
      // World pixels to canvas pixels by the camera's zoom, canvas pixels to CSS pixels by the game's.
      const onPage = seen.zoom * game.scale.zoom;
      return itemSlotsOf(loop.sim).map((itemSlot) => {
        const box = itemSlotBox(itemSlot.slot, seen);
        return { ...itemSlot, onPage: { x: (box.x - seen.x) * onPage, y: (box.y - seen.y) * onPage, width: box.width * onPage, height: box.height * onPage } };
      });
    },
    queueCommand: (command) => loop.queueCommand(command),
    loadLevel: (level) => loop.playLevel(level),
  };
}
