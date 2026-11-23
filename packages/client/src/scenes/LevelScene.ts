import { flagOf, levelOf, stickManOf, type StickManView } from '@stickworld/sim';
import Phaser from 'phaser';
import { sendItemSlotCommands } from '../input/itemSlotKeys';
import { commandsFromKeys, type KeysNow } from '../input/playerCommands';
import { watchPlayerKeys } from '../input/playerKeys';
import type { GameLoop } from '../loop/GameLoop';
import { flagStrokes } from '../render/flag';
import { floorStrokes } from '../render/floor';
import { followStickManWith } from '../render/levelCamera';
import { layPaper, PAPER_COLOUR, type Paper } from '../render/paper';
import { poseOf, stickManStrokes } from '../render/stickMan';
import { createStrokeLayer, type StrokeLayer } from '../render/strokes';

/**
 * The level being played, drawn on the sheet of paper: the paper, the floor
 * line, the flag and the stick man, each as the sim says it is. The keys
 * become commands here and nothing else is decided.
 */
export class LevelScene extends Phaser.Scene {
  private paper!: Paper;
  private floor!: StrokeLayer;
  private flag!: StrokeLayer;
  private stickMan!: StrokeLayer;
  private keysNow!: () => KeysNow;
  private follow!: (stickMan: StickManView) => void;
  private readonly commandsFor = commandsFromKeys();

  constructor(private readonly loop: GameLoop) {
    super('level');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PAPER_COLOUR);
    this.paper = layPaper(this);
    this.floor = createStrokeLayer(this);
    this.flag = createStrokeLayer(this);
    this.stickMan = createStrokeLayer(this);
    this.keysNow = watchPlayerKeys(this);
    sendItemSlotCommands(this, (command) => this.loop.queueCommand(command));
    this.follow = followStickManWith(this.cameras.main);
  }

  override update(_time: number, deltaMs: number): void {
    for (const command of this.commandsFor({ keys: this.keysNow(), sim: this.loop.sim })) this.loop.queueCommand(command);
    this.loop.advanceBy(deltaMs / 1000);

    const { sim } = this.loop;
    const stickMan = stickManOf(sim);
    const flag = flagOf(sim);

    this.follow(stickMan);
    this.paper.cover(this.cameras.main);
    this.floor.show(floorStrokes(levelOf(sim)));
    this.flag.show(flag ? flagStrokes(flag) : []);
    this.stickMan.show(stickManStrokes(poseOf(stickMan)));
  }
}
