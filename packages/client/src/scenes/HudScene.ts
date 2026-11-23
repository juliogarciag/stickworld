import { itemSlotsOf } from '@stickworld/sim';
import Phaser from 'phaser';
import { itemSlotStrokes } from '../hud/itemSlots';
import type { GameLoop } from '../loop/GameLoop';
import { worldSeenBy } from '../render/cameraView';
import { levelZoom } from '../render/levelCamera';
import { createStrokeLayer, type StrokeLayer } from '../render/strokes';

/**
 * What is shown over the sheet of paper and does not move with it: the item
 * slots. It runs beside the level scene, after it, so it is drawn above the
 * paper's tooth and reads the sim the level scene has just advanced. Its
 * camera never scrolls and keeps the level's zoom, so a HUD line is as heavy
 * as a line of the level.
 */
export class HudScene extends Phaser.Scene {
  private itemSlots!: StrokeLayer;

  constructor(private readonly loop: GameLoop) {
    super({ key: HUD_SCENE, active: true });
  }

  create(): void {
    this.itemSlots = createStrokeLayer(this);
  }

  override update(): void {
    const camera = this.cameras.main;
    camera.setZoom(levelZoom(camera));
    this.itemSlots.show(itemSlotStrokes(itemSlotsOf(this.loop.sim), worldSeenBy(camera)));
  }
}

export const HUD_SCENE = 'hud';
