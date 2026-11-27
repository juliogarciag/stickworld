import { describe, expect, it } from 'vitest';
import { createSim } from './create';
import type { Command } from './commands';
import type { Feature } from './feature';
import { Sim } from './sim';
import { defineSlice } from './slice';

describe('Sim.step', () => {
  it('advances one tick per call', () => {
    const sim = createSim({ level: 1 });
    sim.step();
    sim.step([]);
    expect(sim.tick).toBe(2);
  });

  it('hands features only commands that are objects with a string type, and survives anything else', () => {
    const sim = new Sim({ features: [recorderFeature], start: { seed: 1, level: 1 } });
    const received: unknown[] = [null, undefined, 1, 'x', [], { type: 3 }, { kind: 'x' }, { type: 'recorder/keep' }];
    sim.step(received as Command[]);
    sim.step('not an array' as unknown as Command[]);
    expect(sim.snapshot().slices.recorder).toEqual(['recorder/keep']);
    expect(sim.tick).toBe(2);
  });

  it('refuses a level that does not exist', () => {
    expect(() => createSim({ level: 999 })).toThrow(RangeError);
  });

  it('refuses two features that claim the same slice', () => {
    expect(() => new Sim({ features: [recorderFeature, { ...recorderFeature, name: 'copy' }], start: { seed: 1, level: 1 } })).toThrow(/recorder/);
  });
});

describe('a level asked for from inside a tick', () => {
  it('starts once every feature has had the tick, in that same step', () => {
    const sim = new Sim({ features: [askerFeature, witnessFeature], start: { seed: 1, level: 1 } });
    sim.step();
    sim.step([ask(2)]);
    expect(sim.level).toBe(2);
    expect(sim.tick).toBe(2);
    expect(sim.stateOf(ticksOnThisLevelSlice)).toBe(0);
    // It starts in the tick that asked, before the tick count goes up: that is the tick a feature's `init` reads.
    expect(sim.stateOf(tickOfLastStartSlice)).toBe(1);
    sim.step();
    expect(sim.stateOf(ticksOnThisLevelSlice)).toBe(1);
  });

  it('shows the features after the one that asked the level as it was, not one that has only just begun', () => {
    const seen: { level: number; ticksOnThisLevel: number }[] = [];
    const spyFeature: Feature = { name: 'spy', update: (sim) => void seen.push({ level: sim.level, ticksOnThisLevel: sim.stateOf(ticksOnThisLevelSlice) }) };
    const sim = new Sim({ features: [askerFeature, witnessFeature, spyFeature], start: { seed: 1, level: 1 } });
    sim.step();
    sim.step([ask(2)]);
    sim.step();
    expect(seen).toEqual([
      { level: 1, ticksOnThisLevel: 1 },
      { level: 1, ticksOnThisLevel: 2 },
      { level: 2, ticksOnThisLevel: 1 },
    ]);
  });

  it.each([
    { asked: [1, 2], starts: 2, because: 'another level beats the level being played again' },
    { asked: [2, 1], starts: 2, because: 'another level beats the level being played again, whichever was asked for first' },
    { asked: [2, 3], starts: 2, because: 'of two other levels the first asked for is kept' },
    { asked: [3, 'over' as const, 2], starts: 1, because: 'starting over beats a level asked for before or after it' },
  ])('with $asked asked for in one tick level $starts starts: $because', ({ asked, starts }) => {
    const sim = new Sim({ features: [askerFeature, witnessFeature], start: { seed: 1, level: 1 } });
    sim.step(asked.map((what) => (what === 'over' ? askToStartOver() : ask(what))));
    expect(sim.level).toBe(starts);
  });

  it('starts one level however many asked: every feature is set up once', () => {
    const sim = new Sim({ features: [askerFeature, witnessFeature], start: { seed: 1, level: 1 } });
    sim.step([ask(1), ask(2), ask(1)]);
    // Once when the sim was made, once for the level that started.
    expect(sim.stateOf(levelsStartedSlice)).toBe(2);
  });

  it('keeps what carries across levels for a level, and gives it back for starting over', () => {
    const sim = new Sim({ features: [askerFeature, witnessFeature], start: { seed: 1, level: 1 } });
    sim.step([ask(1)]);
    expect(sim.stateOf(levelsStartedSlice)).toBe(2);
    sim.step([askToStartOver()]);
    expect(sim.stateOf(levelsStartedSlice)).toBe(1);
    expect(sim.level).toBe(1);
    expect(sim.tick).toBe(2);
  });

  it('refuses a feature that starts a level or starts over itself in the middle of a tick', () => {
    const impatientFeature: Feature = { name: 'impatient', update: (sim) => sim.startLevel(sim.level) };
    const sim = new Sim({ features: [impatientFeature], start: { seed: 1, level: 1 } });
    expect(() => sim.step()).toThrow(/startLevelAfterThisTick/);
    const startsOverFeature: Feature = { name: 'startsOver', update: (sim) => sim.startOver() };
    expect(() => new Sim({ features: [startsOverFeature], start: { seed: 1, level: 1 } }).step()).toThrow(/startOverAfterThisTick/);
    // After the tick that threw, the sim is between two ticks again.
    expect(() => sim.startLevel(1)).not.toThrow();
  });

  it('leaves nothing asked for behind when the tick throws after the asking', () => {
    const throwsOnceFeature: Feature = {
      name: 'throwsOnce',
      update(sim) {
        if (sim.tick === 0) throw new Error('a bug in a feature');
      },
    };
    const sim = new Sim({ features: [askerFeature, throwsOnceFeature], start: { seed: 1, level: 1 } });
    expect(() => sim.step([ask(2)])).toThrow('a bug in a feature');
    sim.tick = 1;
    sim.step();
    expect(sim.level).toBe(1);
  });

  it("refuses a feature whose `init` starts a level or asks for one: a level being started is not started again half way", () => {
    for (const start of [(sim: Sim) => sim.startLevel(3), (sim: Sim) => sim.startLevelAfterThisTick(3), (sim: Sim) => sim.startOver(), (sim: Sim) => sim.startOverAfterThisTick()]) {
      const restlessFeature: Feature = {
        name: 'restless',
        init(sim) {
          if (sim.level === 2) start(sim);
        },
      };
      const sim = new Sim({ features: [askerFeature, restlessFeature, witnessFeature], start: { seed: 1, level: 1 } });
      expect(() => sim.step([ask(2)])).toThrow(/being started/);
      // The sim can be used again afterwards.
      expect(() => sim.startLevel(1)).not.toThrow();
    }
  });

  it('starts what is asked for at once when no tick is running', () => {
    const sim = new Sim({ features: [askerFeature, witnessFeature], start: { seed: 1, level: 1 } });
    sim.startLevelAfterThisTick(3);
    expect(sim.level).toBe(3);
    sim.startOverAfterThisTick();
    expect(sim.level).toBe(1);
  });
});

// ---- Helpers ----

function ask(level: number): Command {
  return { type: 'asker/level', level } as unknown as Command;
}

function askToStartOver(): Command {
  return { type: 'asker/over' } as unknown as Command;
}

/** A fixture feature: asks for a level, or for the game to start over, when a command says so. */
const askerFeature: Feature = {
  name: 'asker',
  handleCommand(sim, command) {
    const { type, level } = command as { type: string; level?: number };
    if (type === 'asker/level' && level !== undefined) sim.startLevelAfterThisTick(level);
    if (type === 'asker/over') sim.startOverAfterThisTick();
  },
};

const ticksOnThisLevelSlice = defineSlice<number>('ticksOnThisLevel', () => 0, { carriesAcrossLevels: false });
const levelsStartedSlice = defineSlice<number>('levelsStarted', () => 0, { carriesAcrossLevels: true });
const tickOfLastStartSlice = defineSlice<number>('tickOfLastStart', () => -1, { carriesAcrossLevels: false });

/** A fixture feature: counts its ticks on the level being played and the levels started since the game began or started over, and notes the tick its `init` last ran on. */
const witnessFeature: Feature = {
  name: 'witness',
  slices: [ticksOnThisLevelSlice, levelsStartedSlice, tickOfLastStartSlice],
  init(sim) {
    sim.setStateOf(tickOfLastStartSlice, sim.tick);
    sim.setStateOf(levelsStartedSlice, sim.stateOf(levelsStartedSlice) + 1);
  },
  update(sim) {
    sim.setStateOf(ticksOnThisLevelSlice, sim.stateOf(ticksOnThisLevelSlice) + 1);
  },
};

const recorderSlice = defineSlice<string[]>('recorder', () => [], { carriesAcrossLevels: false });

const recorderFeature: Feature = {
  name: 'recorder',
  slices: [recorderSlice],
  handleCommand(sim, command) {
    sim.stateOf(recorderSlice).push((command as { type: string }).type);
  },
};
