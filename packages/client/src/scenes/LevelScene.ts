import Phaser from 'phaser';
import type { GameLoop } from '../loop/GameLoop';
import { PAPER_COLOUR } from '../render/paper';

/**
 * The level being played, drawn on the sheet of paper. For now only the
 * paper: the look test decides how the floor and the stick man are drawn.
 */
export class LevelScene extends Phaser.Scene {
  constructor(private readonly loop: GameLoop) {
    super('level');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PAPER_COLOUR);
  }

  override update(_time: number, deltaMs: number): void {
    this.loop.advanceBy(deltaMs / 1000);
  }
}
