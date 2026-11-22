import { describe, expect, it } from 'vitest';
import { levels } from '../content/levels';
import { features } from '../features';
import type { Command } from './commands';
import type { Feature } from './feature';
import { Sim } from './sim';
import { defineSlice } from './slice';
import { hashSnapshot } from './snapshot';

describe('snapshot', () => {
  it('a restored sim continues exactly as the one it was taken from', () => {
    const original = new Sim({ features: [walkerFeature], start: { seed: 3, level: 1 } });
    for (let tick = 0; tick < 100; tick += 1) original.step([turnCommand(tick)]);
    const restored = new Sim({ features: [walkerFeature], snapshot: original.snapshot() });
    for (let tick = 100; tick < 200; tick += 1) {
      original.step([turnCommand(tick)]);
      restored.step([turnCommand(tick)]);
    }
    expect(restored.snapshot()).toEqual(original.snapshot());
  });

  it('is a copy: changing it, or the sim afterwards, does not reach the other', () => {
    const sim = new Sim({ features: [walkerFeature], start: { seed: 3, level: 1 } });
    const snapshot = sim.snapshot();
    const before = hashSnapshot(snapshot);
    sim.step();
    expect(hashSnapshot(snapshot)).toBe(before);
    (snapshot.slices.walker as Walker).x = 999;
    expect((sim.snapshot().slices.walker as Walker).x).not.toBe(999);
  });

  it.each(levels.map((level) => [level.id]))('holds only plain JSON for every registered feature on level %i', (level) => {
    const sim = new Sim({ features, start: { seed: 1, level } });
    for (let tick = 0; tick < 60; tick += 1) sim.step();
    const snapshot = sim.snapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('hashes equal snapshots equally whatever their key order', () => {
    const snapshot = { seed: 1, tick: 2, level: 1, rngState: 4, slices: { a: { x: 1, y: 2 } } };
    const reordered = { slices: { a: { y: 2, x: 1 } }, rngState: 4, level: 1, tick: 2, seed: 1 };
    expect(hashSnapshot(reordered)).toBe(hashSnapshot(snapshot));
  });

  it('keeps a slice declared to carry across levels when the level restarts, and resets the rest', () => {
    const sim = new Sim({ features: [walkerFeature], start: { seed: 3, level: 1 } });
    for (let tick = 0; tick < 10; tick += 1) sim.step();
    sim.startLevel(1);
    const { slices } = sim.snapshot();
    expect((slices.walker as Walker).x).toBe(levels[0]?.start.x);
    expect(slices.steps).toBe(10);
  });
});

// ---- Helpers ----

interface Walker {
  x: number;
  direction: number;
}

const walkerSlice = defineSlice<Walker>('walker', (level) => ({ x: level.start.x, direction: 1 }));
const stepsSlice = defineSlice<number>('steps', () => 0, { carriesAcrossLevels: true });

/** A fixture feature: walks a point left or right, turns on `walker/turn`, and counts its steps across levels. */
const walkerFeature: Feature = {
  name: 'walker',
  slices: [walkerSlice, stepsSlice],
  handleCommand(sim, command) {
    if ((command as { type: string }).type === 'walker/turn') sim.stateOf(walkerSlice).direction *= -1;
  },
  update(sim) {
    const walker = sim.stateOf(walkerSlice);
    walker.x += walker.direction * sim.dt * (1 + sim.rng.next());
    sim.setStateOf(stepsSlice, sim.stateOf(stepsSlice) + 1);
  },
};

function turnCommand(tick: number): Command {
  return { type: tick % 17 === 0 ? 'walker/turn' : 'walker/none' } as unknown as Command;
}
