import { describe, expect, it } from 'vitest';
import { level3 } from '../../content/levels/level3';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { stickManOf } from '../player/view';
import { checkpointOf } from './view';

describe('the checkpoint', () => {
  it('stands where the level places it, not passed, and a level without one has none', () => {
    expect(checkpointOf(simOn(3))).toEqual({ at: CHECKPOINT, passed: false });
    expect(checkpointOf(simOn(1))).toBeUndefined();
  });

  it('is on the way from the start to the edge of the gap', () => {
    expect(CHECKPOINT.x).toBeGreaterThan(level3.start.x);
    expect(CHECKPOINT.x).toBeLessThan(level3.floor[0]!.to.x);
  });

  it('is passed on the tick he stands at or past it, and not before', () => {
    const sim = simOn(3);
    sim.step([WALK_RIGHT]);
    while (stickManOf(sim).feet.x < CHECKPOINT.x) {
      expect(checkpointOf(sim)!.passed).toBe(false);
      sim.step();
    }
    expect(checkpointOf(sim)!.passed).toBe(true);
  });

  it('is not passed in the air over it: he has to come down past it', () => {
    const sim = simOn(3);
    sim.step([WALK_RIGHT]);
    while (stickManOf(sim).feet.x < CHECKPOINT.x - 0.3) sim.step();
    sim.step([{ type: 'player/jump' }]);
    while (stickManOf(sim).action === 'jumping') {
      if (stickManOf(sim).feet.x >= CHECKPOINT.x) expect(checkpointOf(sim)!.passed).toBe(false);
      sim.step();
    }
    expect(stickManOf(sim).feet.x).toBeGreaterThan(CHECKPOINT.x);
    sim.step();
    expect(checkpointOf(sim)!.passed).toBe(true);
  });

  it('starts him at the start of the level after a death before it', () => {
    const sim = simOn(3);
    walkOffThePaper(sim, -1);
    expect(checkpointOf(sim)!.passed).toBe(false);
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: level3.start });
  });

  it('starts him at the checkpoint after a death past it, standing, and stays passed through any number of deaths', () => {
    const sim = simOn(3);
    for (let death = 1; death <= 3; death += 1) {
      walkOffThePaper(sim, 1);
      expect(checkpointOf(sim)!.passed, `death ${death}`).toBe(true);
      expect(stickManOf(sim), `death ${death}`).toMatchObject({ action: 'standing', feet: CHECKPOINT, verticalSpeed: 0, horizontalSpeed: 0, carrying: false });
    }
  });

  it('is forgotten when another level starts: back on its own level later, he begins at the start', () => {
    const sim = simOn(3);
    walkOffThePaper(sim, 1);
    sim.startLevel(1);
    expect(checkpointOf(sim)).toBeUndefined();
    sim.startLevel(3);
    expect(checkpointOf(sim)!.passed).toBe(false);
    expect(stickManOf(sim).feet).toEqual(level3.start);
  });

  it('is forgotten when the game starts over', () => {
    const sim = simOn(3);
    walkOffThePaper(sim, 1);
    sim.startOver();
    sim.startLevel(3);
    expect(checkpointOf(sim)!.passed).toBe(false);
    expect(stickManOf(sim).feet).toEqual(level3.start);
  });
});

// ---- Helpers ----

const CHECKPOINT = level3.checkpoint!;
const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };

function simOn(level: number): Sim {
  return new Sim({ features, start: { seed: 1, level } });
}

/** He walks off the paper to one side, falls, and the level has started again: he stands on the floor, still. */
function walkOffThePaper(sim: Sim, direction: 1 | -1): void {
  sim.step([{ type: 'player/walk', direction }]);
  let ticks = 0;
  while (stickManOf(sim).feet.y <= 1) {
    sim.step();
    expect((ticks += 1)).toBeLessThan(3000);
  }
  while (stickManOf(sim).feet.y > 0) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}
