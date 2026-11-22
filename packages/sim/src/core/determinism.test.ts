import { describe, expect, it } from 'vitest';
import { levels } from '../content/levels';
import { features } from '../features';
import type { Command } from './commands';
import type { Feature } from './feature';
import { Sim } from './sim';
import { defineSlice } from './slice';
import { hashSnapshot } from './snapshot';

describe('determinism', () => {
  it.each(levels.map((level) => [level.id]))('the registered features replay level %i identically from the same seed and commands', (level) => {
    const first = new Sim({ features, start: { seed: 7, level } });
    const second = new Sim({ features, start: { seed: 7, level } });
    for (let tick = 0; tick < TICKS; tick += 1) {
      first.step(commandsAt(tick));
      second.step(commandsAt(tick));
    }
    expect(hashSnapshot(first.snapshot())).toBe(hashSnapshot(second.snapshot()));
  });

  it('a feature that draws from the rng and takes commands ends in the same state on every run', () => {
    const runs = [1, 2, 3].map(() => {
      const sim = new Sim({ features: [noiseFeature], start: { seed: 42, level: 1 } });
      for (let tick = 0; tick < TICKS; tick += 1) sim.step(tick % 30 === 0 ? [addCommand(tick)] : []);
      return sim.snapshot();
    });
    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
  });

  it('a different seed gives a different state', () => {
    const hashFor = (seed: number): string => {
      const sim = new Sim({ features: [noiseFeature], start: { seed, level: 1 } });
      for (let tick = 0; tick < 10; tick += 1) sim.step();
      return hashSnapshot(sim.snapshot());
    };
    expect(hashFor(1)).not.toBe(hashFor(2));
  });
});

// ---- Helpers ----

const TICKS = 600;

/** A recorded input: well-formed commands nobody owns and garbage, which every feature must ignore without throwing. */
function commandsAt(tick: number): Command[] {
  const garbage: unknown[] = [null, 3, 'player/walk', { type: 7 }, { type: 'nobody/owns-this', amount: tick }];
  return [garbage[tick % garbage.length]] as Command[];
}

interface Noise {
  total: number;
  draws: number[];
}

const noiseSlice = defineSlice<Noise>('noise', () => ({ total: 0, draws: [] }));

/** A fixture feature: adds a random number every tick and the amount of every `noise/add` command. */
const noiseFeature: Feature = {
  name: 'noise',
  slices: [noiseSlice],
  handleCommand(sim, command) {
    const { type, amount } = command as { type: string; amount?: unknown };
    if (type !== 'noise/add' || typeof amount !== 'number' || !Number.isFinite(amount)) return;
    sim.stateOf(noiseSlice).total += amount;
  },
  update(sim) {
    const noise = sim.stateOf(noiseSlice);
    const draw = sim.rng.nextInt(100);
    noise.total += draw;
    noise.draws.push(draw);
  },
};

function addCommand(amount: number): Command {
  return { type: 'noise/add', amount } as unknown as Command;
}
