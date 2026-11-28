import type {
  AirplaneView,
  Command,
  CraftingView,
  Def,
  EnemyView,
  SpearView,
  FallenItemView,
  FlagView,
  FlyingHint,
  GameView,
  InteractionMeaning,
  ItemSlot,
  ItemUseMeaning,
  LetterView,
  Level,
  MovementTuning,
  NoteView,
  SimHandle,
  SimSnapshot,
  StickManView,
} from '@stickworld/sim';
import {
  getAirplane,
  getCrafting,
  defs,
  getEnemies,
  getFallenItem,
  getFlag,
  getFlyingHint,
  getGame,
  hashSnapshot,
  getInteraction,
  getItemSlots,
  getItemUse,
  getLetter,
  getLevel,
  getMovementTuning,
  getNotes,
  getSpear,
  STICK_MAN_HEIGHT,
  STICK_MAN_WIDTH,
  getStickMan,
} from '@stickworld/sim';
import type Phaser from 'phaser';
import { getItemSlotBox, type Rectangle } from './hud/itemSlots';
import { MAX_FRAME_SECONDS } from './loop/frameSeconds';
import type { GameLoop } from './loop/GameLoop';
import { getWorldSeenBy } from './render/cameraView';
import type { PageTurn } from './render/pageTurn';
import { PIXELS_PER_METRE } from './render/units';
import { HUD_SCENE } from './scenes/HudScene';
import { LEVEL_SCENE } from './scenes/LevelScene';

/**
 * What dev tooling and end-to-end checks can reach from the page. Dev builds only; listed in
 * AGENTS.md.
 */
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
  /**
   * The stick man's width in metres, as the sim's tuning has it: how far the end of a floor line
   * the stick man drops past is kept from the middle of it, half to each side.
   */
  readonly stickManWidth: number;
  /**
   * The most real time one frame may give the sim, in seconds: what a longer frame took beyond it
   * is dropped, not played.
   */
  readonly maxFrameSeconds: number;
  takeSnapshot(): SimSnapshot;
  hash(): string;
  /** The level camera right now, or undefined until the level scene runs. */
  getCamera(): CameraView | undefined;
  /**
   * The part of the level the level camera shows right now, in metres, or undefined until the level
   * scene runs.
   */
  getLevelInView(): MetresInView | undefined;
  /**
   * The HUD camera right now, or undefined until the HUD scene runs: its zoom does not follow the
   * level camera's.
   */
  getHudCamera(): CameraView | undefined;
  /**
   * Where the right edge of the sheet being turned away is, as a share of the view's width from its
   * left side, or null when no page is being turned.
   */
  getPageTurn(): { edgeAt: number } | null;
  /** The notes on the level's sheet as the sim has them right now. */
  getNotes(): NoteView[];
  /**
   * How the game ends, as the sim has it right now: whether it is over, and whether playing again
   * is offered.
   */
  getEnding(): GameView;
  /**
   * The stick man as the sim has it right now: where the stick man's feet are (metres) and what it
   * is doing.
   */
  getStickMan(): StickManView;
  /** The level's flag as the sim has it right now, or undefined when the level has none. */
  getFlag(): FlagView | undefined;
  /**
   * Every item slot as the sim has it, with where the HUD draws its box on the page, in CSS pixels.
   * Empty until the HUD scene runs.
   */
  getItemSlots(): ShownItemSlot[];
  /** The level's letter as the sim has it right now, or undefined when there is none to read. */
  getLetter(): LetterView | undefined;
  /**
   * The item that fell from the sky for the stick man who lost the stick man's, as the sim has it
   * right now, or undefined when there is none.
   */
  getFallenItem(): FallenItemView | undefined;
  /**
   * What the stick man knows how to make as the sim has it right now: the recipes the stick man
   * knows, and the one using the held item would make.
   */
  getCrafting(): CraftingView;
  /** The airplane in the world as the sim has it right now, or undefined while there is none. */
  getAirplane(): AirplaneView | undefined;
  /**
   * Every enemy of the level as the sim has it right now: where it is, what it is doing and how far
   * along, and where its club is.
   */
  getEnemies(): EnemyView[];
  /**
   * The spear in the stick man's hand as the sim has it right now: whether it is ready, thrusting
   * or being drawn back, how far along, and where its point is. Undefined while the stick man
   * holds something else or nothing.
   */
  getSpear(): SpearView | undefined;
  /**
   * What the stick man has still to be told about flying the airplane the stick man has, as the sim
   * has it right now, or null.
   */
  getFlyingHint(): FlyingHint | null;
  /**
   * How the stick man walks, jumps and falls right now, as the sim has it: what the movement panel
   * shows and changes.
   */
  getMovementTuning(): MovementTuning;
  /** What using the held item would do right now, or null. */
  getItemUse(): ItemUseMeaning | null;
  /** What interacting with the world would do right now, or null. */
  getInteraction(): InteractionMeaning | null;
  /** Queues a command for the next earned tick, through the same path as keyboard input. */
  queueCommand(command: Command): void;
  /** Plays level `level` from its start. */
  loadLevel(level: number): void;
}

/**
 * The camera as a check needs it: zoom, where it looks, and how big the view is in screen pixels.
 */
export interface CameraView {
  readonly zoom: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
}

/** A part of the level, in metres: y points down, as in the sim. */
export interface MetresInView {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
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

export function exposeDebugApi(sources: {
  loop: GameLoop;
  game: Phaser.Game;
  pageTurn: PageTurn;
}): void {
  const getCameraOf = (scene: string): CameraView | undefined => {
    if (!sources.game.scene.isActive(scene)) {
      return undefined;
    }
    const { zoom, scrollX, scrollY, width, height } =
      sources.game.scene.getScene(scene).cameras.main;
    return { zoom, scrollX, scrollY, width, height };
  };
  window.__game = {
    get sim() {
      return sources.loop.sim;
    },
    game: sources.game,
    get level() {
      return getLevel(sources.loop.sim);
    },
    defs,
    pixelsPerMetre: PIXELS_PER_METRE,
    stickManHeight: STICK_MAN_HEIGHT,
    stickManWidth: STICK_MAN_WIDTH,
    maxFrameSeconds: MAX_FRAME_SECONDS,
    takeSnapshot: () => sources.loop.sim.takeSnapshot(),
    hash: () => hashSnapshot(sources.loop.sim.takeSnapshot()),
    getCamera: () => getCameraOf(LEVEL_SCENE),
    getLevelInView: () => {
      if (!sources.game.scene.isActive(LEVEL_SCENE)) {
        return undefined;
      }
      const seen = getWorldSeenBy(sources.game.scene.getScene(LEVEL_SCENE).cameras.main);
      return {
        left: seen.x / PIXELS_PER_METRE,
        right: (seen.x + seen.width) / PIXELS_PER_METRE,
        top: seen.y / PIXELS_PER_METRE,
        bottom: (seen.y + seen.height) / PIXELS_PER_METRE,
      };
    },
    getHudCamera: () => getCameraOf(HUD_SCENE),
    getPageTurn: () => {
      const turning = sources.pageTurn.getTurningPage();
      return turning ? { edgeAt: turning.edgeAt } : null;
    },
    getNotes: () => getNotes(sources.loop.sim),
    getEnding: () => getGame(sources.loop.sim),
    getStickMan: () => getStickMan(sources.loop.sim),
    getFlag: () => getFlag(sources.loop.sim),
    getItemSlots: () => {
      if (!sources.game.scene.isActive(HUD_SCENE)) {
        return [];
      }
      const seen = getWorldSeenBy(sources.game.scene.getScene(HUD_SCENE).cameras.main);
      // World pixels to canvas pixels by the camera's zoom, canvas pixels to CSS pixels by the
      // game's.
      const cssPixelsPerWorldPixel = seen.zoom * sources.game.scale.zoom;
      return getItemSlots(sources.loop.sim).map((itemSlot) => {
        const box = getItemSlotBox(itemSlot.slot, seen);
        return {
          ...itemSlot,
          onPage: {
            x: (box.x - seen.x) * cssPixelsPerWorldPixel,
            y: (box.y - seen.y) * cssPixelsPerWorldPixel,
            width: box.width * cssPixelsPerWorldPixel,
            height: box.height * cssPixelsPerWorldPixel,
          },
        };
      });
    },
    getLetter: () => getLetter(sources.loop.sim),
    getFallenItem: () => getFallenItem(sources.loop.sim),
    getCrafting: () => getCrafting(sources.loop.sim),
    getAirplane: () => getAirplane(sources.loop.sim),
    getEnemies: () => getEnemies(sources.loop.sim),
    getSpear: () => getSpear(sources.loop.sim),
    getFlyingHint: () => getFlyingHint(sources.loop.sim),
    getMovementTuning: () => getMovementTuning(sources.loop.sim),
    getItemUse: () => getItemUse(sources.loop.sim),
    getInteraction: () => getInteraction(sources.loop.sim),
    queueCommand: (command) => sources.loop.queueCommand(command),
    loadLevel: (level) => sources.loop.playLevel(level),
  };
}
