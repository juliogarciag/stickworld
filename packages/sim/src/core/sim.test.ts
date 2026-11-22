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

// ---- Helpers ----

const recorderSlice = defineSlice<string[]>('recorder', () => []);

const recorderFeature: Feature = {
  name: 'recorder',
  slices: [recorderSlice],
  handleCommand(sim, command) {
    sim.stateOf(recorderSlice).push((command as { type: string }).type);
  },
};
