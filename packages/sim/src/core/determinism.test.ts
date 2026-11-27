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
      first.step(getCommandsAt(tick));
      second.step(getCommandsAt(tick));
    }
    expect(hashSnapshot(first.takeSnapshot())).toBe(hashSnapshot(second.takeSnapshot()));
  });

  it('a feature that draws from the rng and takes commands ends in the same state on every run', () => {
    const runs = [1, 2, 3].map(() => {
      const sim = new Sim({ features: [noiseFeature], start: { seed: 42, level: 1 } });
      for (let tick = 0; tick < TICKS; tick += 1) sim.step(tick % 30 === 0 ? [addCommand(tick)] : []);
      return sim.takeSnapshot();
    });
    expect(runs[1]).toEqual(runs[0]);
    expect(runs[2]).toEqual(runs[0]);
  });

  it('a different seed gives a different state', () => {
    const getHashFor = (seed: number): string => {
      const sim = new Sim({ features: [noiseFeature], start: { seed, level: 1 } });
      for (let tick = 0; tick < 10; tick += 1) sim.step();
      return hashSnapshot(sim.takeSnapshot());
    };
    expect(getHashFor(1)).not.toBe(getHashFor(2));
  });
});

// ---- Helpers ----

const TICKS = 600;

/** A recorded input: the player walking back and forth, jumping and steering, well-formed commands nobody owns, and garbage, which every feature must ignore without throwing. */
function getCommandsAt(tick: number): Command[] {
  const garbage: unknown[] = [null, 3, 'player/walk', { type: 7 }, { type: 'nobody/owns-this', amount: tick }];
  const played: Command[] = [];
  if (tick % 90 === 0) played.push({ type: 'player/walk', direction: tick % 180 === 0 ? 1 : -1 });
  if (tick % 40 === 7) played.push({ type: 'player/jump' });
  if (tick % 50 === 3) played.push({ type: 'airplane/steer', direction: tick % 100 === 3 ? 1 : -1 });
  return [garbage[tick % garbage.length] as Command, ...played];
}

interface Noise {
  total: number;
  draws: number[];
}

const noiseSlice = defineSlice<Noise>('noise', () => ({ total: 0, draws: [] }), { isCarriedAcrossLevels: false });

/** A fixture feature: adds a random number every tick and the amount of every `noise/add` command. */
const noiseFeature: Feature = {
  name: 'noise',
  slices: [noiseSlice],
  handleCommand(sim, command) {
    const { type, amount } = command as { type: string; amount?: unknown };
    if (type !== 'noise/add' || typeof amount !== 'number' || !Number.isFinite(amount)) return;
    sim.getStateOf(noiseSlice).total += amount;
  },
  update(sim) {
    const noise = sim.getStateOf(noiseSlice);
    const draw = sim.rng.getNextInt(100);
    noise.total += draw;
    noise.draws.push(draw);
  },
};

function addCommand(amount: number): Command {
  return { type: 'noise/add', amount } as unknown as Command;
}
