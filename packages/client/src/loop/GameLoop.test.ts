import { createSim, FIXED_DT, flagOf, levelOf, stickManOf, type Command, type SimHandle } from '@stickworld/sim';
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
    const { sim, steps } = recordingSim();
    const loop = new GameLoop(sim);
    loop.queueCommand(fakeCommand('a'));
    loop.advanceBy(FIXED_DT / 2);
    expect(steps).toHaveLength(0);
    loop.advanceBy(FIXED_DT * 2);
    expect(steps).toEqual([[fakeCommand('a')], []]);
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
    expect(flagOf(finished)).toMatchObject({ reached: true, raised: 1 });
    expect(loop.takeFinishedLevel()).toBeUndefined();
  });

  it('keeps nothing when he dies and the same level starts again', () => {
    const loop = new GameLoop(createSim({ level: 1 }));
    loop.queueCommand({ type: 'player/walk', direction: -1 });
    for (let frame = 0; frame < 60 * 6; frame += 1) loop.advanceBy(FIXED_DT);
    expect(stickManOf(loop.sim).feet.x).toBeLessThan(levelOf(loop.sim).start.x + 0.01);
    expect(loop.takeFinishedLevel()).toBeUndefined();
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
function fakeCommand(name: string): Command {
  return { type: `test/${name}` } as unknown as Command;
}

/** A sim that only counts ticks and records the commands each tick was given. */
function recordingSim(): { sim: SimHandle; steps: (readonly Command[])[] } {
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
    snapshot: () => createSim({ level: 1 }).snapshot(),
  };
  return { sim, steps };
}
