import { describe, expect, it } from 'vitest';
import { levelById } from '../content/levels';
import type { Command } from '../core/commands';
import type { Feature } from '../core/feature';
import { Sim } from '../core/sim';
import { features } from './index';
import { tickFlagWasReached } from './flag';
import { whereHeIs } from './player/body';
import { PLAYER } from './player/defs';

/**
 * The game's own features, with one more after them all that only looks: on
 * the tick a feature asks for a level, the features after it still see the
 * level as it was, and the level has started by the time the tick is over.
 */
describe('a level started by the game itself', () => {
  it('after a fall to his death: the features after the player see him below the floor in that tick, and the tick ends with him back at the start', () => {
    const { sim, seen } = simWithAWitness(2);
    const { start } = levelById(2);
    sim.step([WALK_RIGHT]);
    while (whereHeIs(sim).y <= PLAYER.fallBelowFloor - 1) sim.step();
    // He is on his way down the gap, a moment from the end.
    let ticksUntilTheStart = 0;
    while (whereHeIs(sim).y !== start.y) {
      sim.step();
      ticksUntilTheStart += 1;
      expect(ticksUntilTheStart).toBeLessThan(120);
    }
    const tickHeDiedOn = seen[seen.length - 1]!;
    expect(tickHeDiedOn.y).toBeGreaterThan(PLAYER.fallBelowFloor);
    expect(whereHeIs(sim)).toMatchObject({ x: start.x, y: start.y, onFloor: true });
    expect(sim.level).toBe(2);
    sim.step();
    expect(seen[seen.length - 1]).toMatchObject({ level: 2, y: start.y });
  });

  it('after a flag: the features after the flag see the finished level in that tick, and the tick ends on the next level', () => {
    const { sim, seen } = simWithAWitness(1);
    sim.step([WALK_RIGHT]);
    let ticks = 0;
    while (sim.level === 1) {
      sim.step();
      ticks += 1;
      expect(ticks).toBeLessThan(3000);
    }
    expect(seen[seen.length - 1]).toMatchObject({ level: 1, flagReached: true });
    expect(tickFlagWasReached(sim)).toBeNull();
    expect(whereHeIs(sim)).toMatchObject({ x: levelById(2).start.x, y: levelById(2).start.y });
    sim.step();
    expect(seen[seen.length - 1]).toMatchObject({ level: 2, flagReached: false });
  });
});

// ---- Helpers ----

const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };

interface Seen {
  readonly level: number;
  readonly y: number;
  readonly flagReached: boolean;
}

/** A sim of the game's features with a last one that notes, every tick, what it sees after all the others have had theirs. */
function simWithAWitness(level: number): { sim: Sim; seen: Seen[] } {
  const seen: Seen[] = [];
  const witnessFeature: Feature = {
    name: 'witness',
    update: (sim) => void seen.push({ level: sim.level, y: whereHeIs(sim).y, flagReached: tickFlagWasReached(sim) !== null }),
  };
  return { sim: new Sim({ features: [...features, witnessFeature], start: { seed: 1, level } }), seen };
}
