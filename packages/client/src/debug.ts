import type { AirplaneView, Command, CraftingView, Def, FallenItemView, FlagView, FlyingHint, GameView, InteractionMeaning, ItemSlot, ItemUseMeaning, LetterView, Level, MovementTuning, NoteView, SimHandle, SimSnapshot, StickManView } from '@stickworld/sim';
import { getAirplane, getCrafting, defs, getFallenItem, getFlag, getFlyingHint, getGame, hashSnapshot, getInteraction, getItemSlots, getItemUse, getLetter, getLevel, getMovementTuning, getNotes, STICK_MAN_HEIGHT, STICK_MAN_WIDTH, getStickMan } from '@stickworld/sim';
import type Phaser from 'phaser';
import { getItemSlotBox, type Rectangle } from './hud/itemSlots';
import { MAX_FRAME_SECONDS } from './loop/frameSeconds';
import type { GameLoop } from './loop/GameLoop';
import { getWorldSeenBy } from './render/cameraView';
import type { PageTurn } from './render/pageTurn';
import { PIXELS_PER_METRE } from './render/units';
import { HUD_SCENE } from './scenes/HudScene';
import { LEVEL_SCENE } from './scenes/LevelScene';

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
  /** The most real time one frame may give the sim, in seconds: what a longer frame took beyond it is dropped, not played. */
  readonly maxFrameSeconds: number;
  takeSnapshot(): SimSnapshot;
  hash(): string;
  /** The level camera right now, or undefined until the level scene runs. */
  getCamera(): CameraView | undefined;
  /** The part of the level the level camera shows right now, in metres, or undefined until the level scene runs. */
  getLevelInView(): MetresInView | undefined;
  /** The HUD camera right now, or undefined until the HUD scene runs: its zoom does not follow the level camera's. */
  getHudCamera(): CameraView | undefined;
  /** Where the right edge of the sheet being turned away is, as a share of the view's width from its left side, or null when no page is being turned. */
  getPageTurn(): { edgeAt: number } | null;
  /** The notes on the level's sheet as the sim has them right now. */
  getNotes(): NoteView[];
  /** How the game ends, as the sim has it right now: whether it is over, and whether playing again is offered. */
  getEnding(): GameView;
  /** The stick man as the sim has him right now: where his feet are (metres) and what he is doing. */
  getStickMan(): StickManView;
  /** The level's flag as the sim has it right now, or undefined when the level has none. */
  getFlag(): FlagView | undefined;
  /** Every item slot as the sim has it, with where the HUD draws its box on the page, in CSS pixels. Empty until the HUD scene runs. */
  getItemSlots(): ShownItemSlot[];
  /** The level's letter as the sim has it right now, or undefined when there is none to read. */
  getLetter(): LetterView | undefined;
  /** The item that fell from the sky for him who lost his, as the sim has it right now, or undefined when there is none. */
  getFallenItem(): FallenItemView | undefined;
  /** What he knows how to make as the sim has it right now: the recipes he knows, and the one using the held item would make. */
  getCrafting(): CraftingView;
  /** The airplane in the world as the sim has it right now, or undefined while there is none. */
  getAirplane(): AirplaneView | undefined;
  /** What he has still to be told about flying the airplane he has, as the sim has it right now, or null. */
  getFlyingHint(): FlyingHint | null;
  /** How he walks, jumps and falls right now, as the sim has it: what the movement panel shows and changes. */
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

/** The camera as a check needs it: zoom, where it looks, and how big the view is in screen pixels. */
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

export function exposeDebugApi({ loop, game, pageTurn }: { loop: GameLoop; game: Phaser.Game; pageTurn: PageTurn }): void {
  const getCameraOf = (scene: string): CameraView | undefined => {
    if (!game.scene.isActive(scene)) return undefined;
    const { zoom, scrollX, scrollY, width, height } = game.scene.getScene(scene).cameras.main;
    return { zoom, scrollX, scrollY, width, height };
  };
  window.__game = {
    get sim() {
      return loop.sim;
    },
    game,
    get level() {
      return getLevel(loop.sim);
    },
    defs,
    pixelsPerMetre: PIXELS_PER_METRE,
    stickManHeight: STICK_MAN_HEIGHT,
    stickManWidth: STICK_MAN_WIDTH,
    maxFrameSeconds: MAX_FRAME_SECONDS,
    takeSnapshot: () => loop.sim.takeSnapshot(),
    hash: () => hashSnapshot(loop.sim.takeSnapshot()),
    getCamera: () => getCameraOf(LEVEL_SCENE),
    getLevelInView: () => {
      if (!game.scene.isActive(LEVEL_SCENE)) return undefined;
      const seen = getWorldSeenBy(game.scene.getScene(LEVEL_SCENE).cameras.main);
      return { left: seen.x / PIXELS_PER_METRE, right: (seen.x + seen.width) / PIXELS_PER_METRE, top: seen.y / PIXELS_PER_METRE, bottom: (seen.y + seen.height) / PIXELS_PER_METRE };
    },
    getHudCamera: () => getCameraOf(HUD_SCENE),
    getPageTurn: () => {
      const turning = pageTurn.getTurningPage();
      return turning ? { edgeAt: turning.edgeAt } : null;
    },
    getNotes: () => getNotes(loop.sim),
    getEnding: () => getGame(loop.sim),
    getStickMan: () => getStickMan(loop.sim),
    getFlag: () => getFlag(loop.sim),
    getItemSlots: () => {
      if (!game.scene.isActive(HUD_SCENE)) return [];
      const seen = getWorldSeenBy(game.scene.getScene(HUD_SCENE).cameras.main);
      // World pixels to canvas pixels by the camera's zoom, canvas pixels to CSS pixels by the game's.
      const cssPixelsPerWorldPixel = seen.zoom * game.scale.zoom;
      return getItemSlots(loop.sim).map((itemSlot) => {
        const box = getItemSlotBox(itemSlot.slot, seen);
        return { ...itemSlot, onPage: { x: (box.x - seen.x) * cssPixelsPerWorldPixel, y: (box.y - seen.y) * cssPixelsPerWorldPixel, width: box.width * cssPixelsPerWorldPixel, height: box.height * cssPixelsPerWorldPixel } };
      });
    },
    getLetter: () => getLetter(loop.sim),
    getFallenItem: () => getFallenItem(loop.sim),
    getCrafting: () => getCrafting(loop.sim),
    getAirplane: () => getAirplane(loop.sim),
    getFlyingHint: () => getFlyingHint(loop.sim),
    getMovementTuning: () => getMovementTuning(loop.sim),
    getItemUse: () => getItemUse(loop.sim),
    getInteraction: () => getInteraction(loop.sim),
    queueCommand: (command) => loop.queueCommand(command),
    loadLevel: (level) => loop.playLevel(level),
  };
}
