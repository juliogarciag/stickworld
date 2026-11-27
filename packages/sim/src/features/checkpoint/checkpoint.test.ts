import { describe, expect, it } from 'vitest';
import { level3 } from '../../content/levels/level3';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { beginHimAt } from '../player/body';
import { stickManOf } from '../player/view';
import { checkpointOf } from './view';

describe('the checkpoint', () => {
  it('stands where the level places it, not passed, and a level without one has none', () => {
    expect(checkpointOf(simOn(3))).toEqual({ at: CHECKPOINT, passed: false });
    expect(checkpointOf(simOn(1))).toBeUndefined();
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

  it('is passed standing exactly at it: at or past, not only past', () => {
    const sim = standingAt(CHECKPOINT.x);
    expect(checkpointOf(sim)!.passed).toBe(false);
    sim.step();
    expect(checkpointOf(sim)!.passed).toBe(true);
    const aStepShort = standingAt(CHECKPOINT.x - 0.01);
    aStepShort.step();
    expect(checkpointOf(aStepShort)!.passed).toBe(false);
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
    // The loop ends on the tick he lands, and that is the tick it is passed.
    expect(stickManOf(sim).feet.x).toBeGreaterThan(CHECKPOINT.x);
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

  it('forgets a checkpoint passed on another level even when the level that starts has one of its own', () => {
    // No two levels have a checkpoint yet, so the state is made by hand: the checkpoint of level 2 passed, and level 3 starting.
    const before = simOn(2).snapshot();
    const sim = new Sim({ features, snapshot: { ...before, slices: { ...before.slices, checkpoint: { passedOnLevel: 2 } } } });
    sim.startLevel(3);
    expect(checkpointOf(sim)!.passed).toBe(false);
    expect(stickManOf(sim).feet).toEqual(level3.start);
  });

  it('is kept by a snapshot: a restored game has it passed, and starts him there after a death', () => {
    const sim = simOn(3);
    walkOffThePaper(sim, 1);
    const restored = new Sim({ features, snapshot: sim.snapshot() });
    expect(checkpointOf(restored)!.passed).toBe(true);
    walkOffThePaper(restored, 1);
    expect(stickManOf(restored).feet).toEqual(CHECKPOINT);
  });

  it('moves him only while a level is being started: the player refuses to be moved like that once it is under way', () => {
    expect(() => beginHimAt(simOn(3), CHECKPOINT)).toThrow(/init/);
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

/** A sim on level 3 with him standing still on the floor at `x`, as a snapshot has it. */
function standingAt(x: number): Sim {
  const before = simOn(3).snapshot();
  return new Sim({ features, snapshot: { ...before, slices: { ...before.slices, player: { ...(before.slices.player as object), x } } } });
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
