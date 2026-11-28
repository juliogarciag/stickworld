import {
  createSim,
  FIXED_DT,
  getFlag,
  getLevel,
  getStickMan,
  type Command,
  type SimHandle,
} from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
  it('advances the sim only by the whole ticks real time has earned', () => {
    const loop = new GameLoop(createSim({ level: 1 }));
    expect(loop.advanceBy(FIXED_DT * 0.6)).toBe(0);
    expect(loop.advanceBy(FIXED_DT * 2.6)).toBe(3);
    expect(loop.sim.tick).toBe(3);
  });

  it('hands queued commands to the next earned tick, once', () => {
    const { sim, steps } = createRecordingSim();
    const loop = new GameLoop(sim);
    loop.queueCommand(makeFakeCommand('a'));
    loop.advanceBy(FIXED_DT / 2);
    expect(steps).toHaveLength(0);
    loop.advanceBy(FIXED_DT * 2);
    expect(steps).toEqual([[makeFakeCommand('a')], []]);
  });

  it('keeps the level that gave way to the next as it was on its last tick, to be taken once', () => {
    const loop = new GameLoop(createSim({ level: 1 }));
    loop.queueCommand({ type: 'player/walk', direction: 1 });
    expect(loop.takeFinishedLevel()).toBeUndefined();
    let lastTickOnLevel1 = 0;
    for (let frame = 0; frame < 60 * 20 && loop.sim.level === 1; frame += 1) {
      lastTickOnLevel1 = loop.sim.tick;
      loop.advanceBy(FIXED_DT);
    }
    expect(loop.sim.level).toBe(2);
    const finished = loop.takeFinishedLevel()!;
    expect(finished.level).toBe(1);
    expect(finished.tick).toBe(lastTickOnLevel1);
    expect(getFlag(finished)).toMatchObject({ isReached: true, raised: 1 });
    expect(loop.takeFinishedLevel()).toBeUndefined();
  });

  it('keeps nothing when the stick man dies and the same level starts again', () => {
    const loop = new GameLoop(createSim({ level: 1 }));
    loop.queueCommand({ type: 'player/walk', direction: -1 });
    let deepest = 0;
    for (
      let frame = 0;
      frame < 60 * 6 && !(deepest > 1 && getStickMan(loop.sim).feet.y === 0);
      frame += 1
    ) {
      loop.advanceBy(FIXED_DT);
      deepest = Math.max(deepest, getStickMan(loop.sim).feet.y);
    }
    // The stick man fell off the paper and is back where the level starts.
    expect(deepest).toBeGreaterThan(1);
    expect(getStickMan(loop.sim).feet).toEqual(getLevel(loop.sim).start);
    expect(loop.sim.level).toBe(1);
    expect(loop.takeFinishedLevel()).toBeUndefined();
  });

  it('plays on from a snapshot: the sim is as the one it was taken from, and what was waiting is dropped', () => {
    const loop = new GameLoop(createSim({ level: 1 }));
    loop.advanceBy(FIXED_DT * 5);
    const snapshot = loop.sim.takeSnapshot();
    loop.advanceBy(FIXED_DT * 5);
    loop.queueCommand(makeFakeCommand('dropped'));
    loop.playSnapshot(snapshot);
    expect(loop.sim.takeSnapshot()).toEqual(snapshot);
    loop.advanceBy(FIXED_DT);
    expect(loop.sim.tick).toBe(6);
  });

  it('starts a level over from tick 0', () => {
    const loop = new GameLoop(createSim({ level: 1 }));
    loop.advanceBy(FIXED_DT * 5);
    loop.playLevel(1);
    expect(loop.sim.tick).toBe(0);
  });
});

// ---- Helpers ----

/** No feature has commands yet, so the test sends one the sim will ignore. */
function makeFakeCommand(name: string): Command {
  return { type: `test/${name}` } as unknown as Command;
}

/** A sim that only counts ticks and records the commands each tick was given. */
function createRecordingSim(): { sim: SimHandle; steps: (readonly Command[])[] } {
  const steps: (readonly Command[])[] = [];
  const sim = {
    tick: 0,
    dt: FIXED_DT,
    seed: 1,
    level: 1,
    step(commands: readonly Command[] = []) {
      steps.push(commands);
      sim.tick += 1;
    },
    takeSnapshot: () => createSim({ level: 1 }).takeSnapshot(),
  };
  return { sim, steps };
}
