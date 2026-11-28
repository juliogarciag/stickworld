import {
  getEnemies,
  getLevel,
  getSpear,
  getStickMan,
  type SimHandle,
  type SimSnapshot,
} from '@stickworld/sim';
import Phaser from 'phaser';
import { sendActionCommands } from '../input/actionKeys';
import { sendGameCommands } from '../input/gameKeys';
import { sendItemSlotCommands } from '../input/itemSlotKeys';
import { createKeysToCommands, type HeldKeys } from '../input/playerCommands';
import { watchPlayerKeys } from '../input/playerKeys';
import { watchTryoutKeys } from '../input/tryoutKeys';
import { getFrameSeconds } from '../loop/frameSeconds';
import type { GameLoop } from '../loop/GameLoop';
import { selectNextEnemyDeath } from '../render/enemyDeaths';
import { followStickManWith } from '../render/levelCamera';
import type { PageTurn } from '../render/pageTurn';
import { PAPER_COLOUR } from '../render/paper';
import { Sheet } from './Sheet';

/**
 * The level being played, drawn on its sheet of paper as the sim says it
 * is. The keys become commands here, the sim is advanced, and when it has
 * moved on to another level the sheet that was left is handed to the page
 * turn. Nothing about the game is decided.
 */
export class LevelScene extends Phaser.Scene {
  private sheet!: Sheet;
  private getHeldKeys!: () => HeldKeys;
  private follow!: ReturnType<typeof followStickManWith>;
  private readonly commandsFor = createKeysToCommands();
  /**
   * The sheet on top and how long it has been: a new one when the sim is on another level, or is
   * another sim.
   */
  private onTop: { sim: SimHandle; level: number; seconds: number } | undefined;
  /**
   * TRYOUT (#44): the game as it was when the stick man first stood with the spear in its hand
   * and the enemy at its post, on the level it was: where R goes back to.
   */
  private withSpear: { level: number; snapshot: SimSnapshot } | undefined;

  constructor(
    private readonly loop: GameLoop,
    private readonly pageTurn: PageTurn,
  ) {
    super(LEVEL_SCENE);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PAPER_COLOUR);
    this.sheet = new Sheet(this);
    this.getHeldKeys = watchPlayerKeys(this);
    const queue = this.loop.queueCommand.bind(this.loop);
    sendItemSlotCommands(this, queue);
    sendActionCommands(this, queue);
    sendGameCommands(this, queue);
    this.follow = followStickManWith(this.cameras.main);
    if (import.meta.env.DEV) {
      watchTryoutKeys(this, {
        selectNext: () => void selectNextEnemyDeath(),
        playAgain: () => this.playAgainWithSpear(),
      });
    }
  }

  /** TRYOUT (#44): back to the stick man with the spear, or to the start of the level. */
  private playAgainWithSpear(): void {
    const saved = this.withSpear;
    const isSavedHere = saved !== undefined && saved.level === this.loop.sim.level;
    if (isSavedHere) {
      this.loop.playSnapshot(saved.snapshot);
    } else {
      this.loop.playLevel(this.loop.sim.level);
    }
  }

  /** TRYOUT (#44): keeps the first moment the stick man has the spear and nothing has happened. */
  private keepMomentWithSpear(sim: SimHandle): void {
    const isKept = this.withSpear?.level === sim.level;
    const isMoment =
      getSpear(sim)?.action === 'ready' &&
      getStickMan(sim).action === 'standing' &&
      getEnemies(sim).some((enemy) => enemy.rubbedOutProgress === null);
    const shouldKeep = isMoment && !isKept;
    if (shouldKeep) {
      this.withSpear = { level: sim.level, snapshot: sim.takeSnapshot() };
    }
  }

  override update(_time: number, deltaMs: number): void {
    for (const command of this.commandsFor({ keys: this.getHeldKeys(), sim: this.loop.sim })) {
      this.loop.queueCommand(command);
    }
    const seconds = getFrameSeconds(deltaMs);
    this.loop.advanceBy(seconds);

    const camera = this.cameras.main;
    const finished = this.loop.takeFinishedLevel();
    // The camera still looks at the level that was left: the sheet that is turned away is drawn as
    // it was last seen.
    if (finished) {
      this.pageTurn.start({
        sim: finished,
        camera: { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom },
      });
    } else {
      this.pageTurn.advanceBy(seconds);
    }

    const { sim } = this.loop;
    if (import.meta.env.DEV) {
      this.keepMomentWithSpear(sim);
    }
    const previous = this.onTop;
    const isSheetOnTop =
      previous !== undefined && previous.sim === sim && previous.level === sim.level;
    this.onTop = {
      sim,
      level: sim.level,
      seconds: isSheetOnTop ? previous.seconds + seconds : 0,
    };
    this.follow({ stickMan: getStickMan(sim), floor: getLevel(sim).floor, seconds });
    this.sheet.draw({ sim, seconds, secondsOnSheet: this.onTop.seconds });
  }
}

export const LEVEL_SCENE = 'level';
