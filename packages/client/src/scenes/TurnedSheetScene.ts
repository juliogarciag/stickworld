import Phaser from 'phaser';
import type { PageTurn } from '../render/pageTurn';
import { everyFrameAfterTheLevel } from './afterTheLevel';
import { Sheet } from './Sheet';

/**
 * The sheet of the level that was just finished, on its way out: drawn over
 * the level being played, as it was on its last tick, in a view that slides
 * off to the left. It is there only while a page is being turned
 * (`PageTurn`); the pencil line and the shadow at its edge are the HUD's.
 */
export class TurnedSheetScene extends Phaser.Scene {
  private sheet!: Sheet;

  constructor(private readonly pageTurn: PageTurn) {
    super({ key: TURNED_SHEET_SCENE, active: true });
  }

  create(): void {
    this.sheet = new Sheet(this);
    this.cameras.main.setVisible(false);
    everyFrameAfterTheLevel(this, (seconds) => this.draw(seconds));
  }

  private draw(seconds: number): void {
    const camera = this.cameras.main;
    const turning = this.pageTurn.now();
    camera.setVisible(turning !== undefined);
    // Phaser only resizes a camera with the window while it sits at the canvas's corner, which this one does not during a turn: it is given the canvas's size every frame.
    const { width, height } = this.scale;
    if (!turning) {
      camera.setViewport(0, 0, width, height);
      this.sheet.clear();
      return;
    }
    // The view itself moves across the canvas, and what it shows is cut off at its sides: the sheet's right edge is the view's.
    camera.setViewport(Math.round((turning.edgeAt - 1) * width), 0, width, height);
    camera.setZoom(turning.camera.zoom);
    camera.setScroll(turning.camera.scrollX, turning.camera.scrollY);
    // What was written on it as it arrived was rubbed out long ago, or would have been.
    this.sheet.draw({ sim: turning.sim, seconds, secondsOnTheSheet: Infinity });
  }
}

export const TURNED_SHEET_SCENE = 'turned-sheet';
