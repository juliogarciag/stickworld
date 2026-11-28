import {
  createSim,
  restoreSim,
  type Command,
  type SimHandle,
  type SimSnapshot,
} from '@stickworld/sim';
import { MAX_FRAME_SECONDS } from './frameSeconds';
import { takeWholeTicks } from './takeWholeTicks';

/**
 * The one place the sim advances. Real time comes in from the scene, whole
 * sim ticks go out; commands wait in `pendingCommands` until the leftover
 * earns a tick, so the sim only ever moves with real time.
 */
export class GameLoop {
  private leftover = 0;
  private pendingCommands: Command[] = [];
  private finishedLevel: SimHandle | undefined;

  constructor(private current: SimHandle) {}

  /** The sim being played. A new object after `playLevel`. */
  get sim(): SimHandle {
    return this.current;
  }

  /**
   * Runs as many ticks as `deltaSeconds` of real time earns, and says how many ran. A scene hands
   * it `getFrameSeconds`, which is capped already; the cap is given to `takeWholeTicks` all the
   * same, so that no caller can make the sim run more.
   */
  advanceBy(deltaSeconds: number): number {
    const { ticks, leftover } = takeWholeTicks({
      leftover: this.leftover,
      deltaSeconds,
      dt: this.current.dt,
      maxFrameSeconds: MAX_FRAME_SECONDS,
    });
    this.leftover = leftover;
    for (let tick = 0; tick < ticks; tick += 1) {
      // The sim moves to the next level by itself, within one tick. The tick before is kept each
      // time, so the sheet that was left can still be drawn: a snapshot is a few hundred bytes.
      const level = this.current.level;
      const tickBefore = this.current.takeSnapshot();
      this.current.step(this.pendingCommands);
      this.pendingCommands = [];
      if (this.current.level !== level) {
        this.finishedLevel = restoreSim(tickBefore);
      }
    }
    return ticks;
  }

  /**
   * The level that gave way to another since this was last asked, as it was on its last tick, or
   * undefined when none did. A sim of its own that is never stepped: it is for drawing the sheet
   * that was left, once.
   */
  takeFinishedLevel(): SimHandle | undefined {
    const finishedLevel = this.finishedLevel;
    this.finishedLevel = undefined;
    return finishedLevel;
  }

  /** Holds `command` for the next earned tick. */
  queueCommand(command: Command): void {
    this.pendingCommands.push(command);
  }

  /**
   * Throws the current sim away and plays level `level` from its start, with the same seed. Dev
   * tooling only: in play, the sim moves between levels itself.
   */
  playLevel(level: number): void {
    this.current = createSim({ level, seed: this.current.seed });
    this.pendingCommands = [];
    this.leftover = 0;
    this.finishedLevel = undefined;
  }

  /**
   * Throws the current sim away and plays on from `snapshot`, as the sim it was taken from would
   * have. Dev tooling only: how a check starts in the middle of a game, with what a stick man
   * that came through earlier levels knows and holds.
   */
  playSnapshot(snapshot: SimSnapshot): void {
    this.current = restoreSim(snapshot);
    this.pendingCommands = [];
    this.leftover = 0;
    this.finishedLevel = undefined;
  }
}
