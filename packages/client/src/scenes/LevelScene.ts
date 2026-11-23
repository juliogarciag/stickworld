import { levelOf, type Level, type SimHandle } from '@stickworld/sim';
import Phaser from 'phaser';
import { walkAlongTheFloor, type WalkDemo } from '../demo/walkAlongTheFloor';
import { sendItemSlotKeys } from '../input/itemSlotKeys';
import { watchWalkKeys, type HeldDirection } from '../input/walkKeys';
import type { GameLoop } from '../loop/GameLoop';
import { floorStrokes } from '../render/floor';
import { frameStickMan } from '../render/levelCamera';
import { layPaper, PAPER_COLOUR, type Paper } from '../render/paper';
import { stickManStrokes } from '../render/stickMan';
import { createStrokeLayer, type StrokeLayer } from '../render/strokes';

/**
 * The level being played, drawn on the sheet of paper: the paper, the floor
 * line and the stick man. The stick man's walk is the look test's demo
 * (`demo/walkAlongTheFloor.ts`) until walking is a sim rule.
 */
export class LevelScene extends Phaser.Scene {
  private paper!: Paper;
  private floor!: StrokeLayer;
  private stickMan!: StrokeLayer;
  private heldDirection!: () => HeldDirection;
  private demo: WalkDemo | undefined;
  private demoSim: SimHandle | undefined;

  constructor(private readonly loop: GameLoop) {
    super('level');
  }

  /** The look test's walk, for dev tooling and checks. Undefined until the scene has drawn once. */
  get walkDemo(): WalkDemo | undefined {
    return this.demo;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PAPER_COLOUR);
    this.paper = layPaper(this);
    this.floor = createStrokeLayer(this);
    this.stickMan = createStrokeLayer(this);
    this.heldDirection = watchWalkKeys(this);
    sendItemSlotKeys(this, (command) => this.loop.queueCommand(command));
  }

  /** The walk on `level`, started again whenever the loop plays a new sim (a level starts or restarts). */
  private demoOn(level: Level): WalkDemo {
    if (!this.demo || this.demoSim !== this.loop.sim) {
      this.demo = walkAlongTheFloor(level);
      this.demoSim = this.loop.sim;
    }
    return this.demo;
  }

  override update(_time: number, deltaMs: number): void {
    const seconds = deltaMs / 1000;
    this.loop.advanceBy(seconds);

    const level = levelOf(this.loop.sim);
    const pose = this.demoOn(level).walkFor(seconds, this.heldDirection());

    frameStickMan(this.cameras.main, pose.feet);
    this.paper.cover(this.cameras.main);
    this.floor.show(floorStrokes(level));
    this.stickMan.show(stickManStrokes(pose));
  }
}
