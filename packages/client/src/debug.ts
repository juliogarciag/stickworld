import type { AirplaneView, Command, CraftingView, Def, FlagView, InteractionMeaning, ItemSlot, ItemUseMeaning, LetterView, Level, SimHandle, SimSnapshot, StickManView } from '@stickworld/sim';
import { airplaneOf, craftingOf, defs, flagOf, hashSnapshot, interactionOf, itemSlotsOf, itemUseOf, letterOf, levelOf, STICK_MAN_HEIGHT, STICK_MAN_WIDTH, stickManOf } from '@stickworld/sim';
import type Phaser from 'phaser';
import { itemSlotBox, type Rectangle } from './hud/itemSlots';
import type { GameLoop } from './loop/GameLoop';
import { worldSeenBy } from './render/cameraView';
import { PIXELS_PER_METRE } from './render/units';
import { HUD_SCENE } from './scenes/HudScene';

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
  /** The stick man's width in metres, as the sim's tuning has it: how far the end of a floor line he drops past is kept from the middle of him, half to each side. */
  readonly stickManWidth: number;
  snapshot(): SimSnapshot;
  hash(): string;
  /** The level camera right now, or undefined until the level scene runs. */
  camera(): CameraView | undefined;
  /** The stick man as the sim has him right now: where his feet are (metres) and what he is doing. */
  stickMan(): StickManView;
  /** The level's flag as the sim has it right now, or undefined when the level has none. */
  flag(): FlagView | undefined;
  /** Every item slot as the sim has it, with where the HUD draws its box on the page, in CSS pixels. Empty until the HUD scene runs. */
  itemSlots(): ShownItemSlot[];
  /** The level's letter as the sim has it right now, or undefined when there is none to read. */
  letter(): LetterView | undefined;
  /** What he knows how to make as the sim has it right now: the recipes he knows, and the one using the held item would make. */
  crafting(): CraftingView;
  /** The airplane in the world as the sim has it right now, or undefined while there is none. */
  airplane(): AirplaneView | undefined;
  /** What using the held item would do right now, or null. */
  itemUse(): ItemUseMeaning | null;
  /** What interacting with the world would do right now, or null. */
  interaction(): InteractionMeaning | null;
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
    stickManWidth: STICK_MAN_WIDTH,
    snapshot: () => loop.sim.snapshot(),
    hash: () => hashSnapshot(loop.sim.snapshot()),
    camera: () => {
      if (!game.scene.isActive('level')) return undefined;
      const { zoom, scrollX, scrollY, width, height } = game.scene.getScene('level').cameras.main;
      return { zoom, scrollX, scrollY, width, height };
    },
    stickMan: () => stickManOf(loop.sim),
    flag: () => flagOf(loop.sim),
    itemSlots: () => {
      if (!game.scene.isActive(HUD_SCENE)) return [];
      const seen = worldSeenBy(game.scene.getScene(HUD_SCENE).cameras.main);
      // World pixels to canvas pixels by the camera's zoom, canvas pixels to CSS pixels by the game's.
      const cssPixelsPerWorldPixel = seen.zoom * game.scale.zoom;
      return itemSlotsOf(loop.sim).map((itemSlot) => {
        const box = itemSlotBox(itemSlot.slot, seen);
        return { ...itemSlot, onPage: { x: (box.x - seen.x) * cssPixelsPerWorldPixel, y: (box.y - seen.y) * cssPixelsPerWorldPixel, width: box.width * cssPixelsPerWorldPixel, height: box.height * cssPixelsPerWorldPixel } };
      });
    },
    letter: () => letterOf(loop.sim),
    crafting: () => craftingOf(loop.sim),
    airplane: () => airplaneOf(loop.sim),
    itemUse: () => itemUseOf(loop.sim),
    interaction: () => interactionOf(loop.sim),
    queueCommand: (command) => loop.queueCommand(command),
    loadLevel: (level) => loop.playLevel(level),
  };
}
