import { createSim, FIXED_DT, type Command, type SimHandle } from '@stickworld/sim';
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
