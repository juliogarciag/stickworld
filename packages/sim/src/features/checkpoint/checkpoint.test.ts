import { describe, expect, it } from 'vitest';
import { level3 } from '../../content/levels/level3';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { startPlayerAt } from '../player/body';
import { getStickMan } from '../player/view';
import { getCheckpoint } from './view';

describe('the checkpoint', () => {
  it('stands where the level places it, not passed, and a level without one has none', () => {
    expect(getCheckpoint(createSimOn(3))).toEqual({ position: CHECKPOINT, isPassed: false });
    expect(getCheckpoint(createSimOn(1))).toBeUndefined();
  });

  it('is passed on the tick the stick man stands at or past it, and not before', () => {
    const sim = createSimOn(3);
    sim.step([WALK_RIGHT]);
    while (getStickMan(sim).feet.x < CHECKPOINT.x) {
      expect(getCheckpoint(sim)!.isPassed).toBe(false);
      sim.step();
    }
    expect(getCheckpoint(sim)!.isPassed).toBe(true);
  });

  it('is passed standing exactly at it: at or past, not only past', () => {
    const sim = createSimStandingAt(CHECKPOINT.x);
    expect(getCheckpoint(sim)!.isPassed).toBe(false);
    sim.step();
    expect(getCheckpoint(sim)!.isPassed).toBe(true);
    const oneStepShort = createSimStandingAt(CHECKPOINT.x - 0.01);
    oneStepShort.step();
    expect(getCheckpoint(oneStepShort)!.isPassed).toBe(false);
  });

  it('is not passed in the air over it: the stick man has to come down past it', () => {
    const sim = createSimOn(3);
    sim.step([WALK_RIGHT]);
    while (getStickMan(sim).feet.x < CHECKPOINT.x - 0.3) sim.step();
    sim.step([{ type: 'player/jump' }]);
    while (getStickMan(sim).action === 'jumping') {
      if (getStickMan(sim).feet.x >= CHECKPOINT.x) expect(getCheckpoint(sim)!.isPassed).toBe(false);
      sim.step();
    }
    // The loop ends on the tick the stick man lands, and that is the tick it is passed.
    expect(getStickMan(sim).feet.x).toBeGreaterThan(CHECKPOINT.x);
    expect(getCheckpoint(sim)!.isPassed).toBe(true);
  });

  it('starts the stick man at the start of the level after a death before it', () => {
    const sim = createSimOn(3);
    walkOffPaper(sim, -1);
    expect(getCheckpoint(sim)!.isPassed).toBe(false);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: level3.start });
  });

  it('starts the stick man at the checkpoint after a death past it, standing, and stays passed through any number of deaths', () => {
    const sim = createSimOn(3);
    for (let death = 1; death <= 3; death += 1) {
      walkOffPaper(sim, 1);
      expect(getCheckpoint(sim)!.isPassed, `death ${death}`).toBe(true);
      expect(getStickMan(sim), `death ${death}`).toMatchObject({ action: 'standing', feet: CHECKPOINT, verticalSpeed: 0, horizontalSpeed: 0, isCarrying: false });
    }
  });

  it('is forgotten when another level starts: back on its own level later, the stick man begins at the start', () => {
    const sim = createSimOn(3);
    walkOffPaper(sim, 1);
    sim.startLevel(1);
    expect(getCheckpoint(sim)).toBeUndefined();
    sim.startLevel(3);
    expect(getCheckpoint(sim)!.isPassed).toBe(false);
    expect(getStickMan(sim).feet).toEqual(level3.start);
  });

  it('forgets a checkpoint passed on another level even when the level that starts has one of its own', () => {
    // No two levels have a checkpoint yet, so the state is made by hand: the checkpoint of level 2 passed, and level 3 starting.
    const before = createSimOn(2).takeSnapshot();
    const sim = new Sim({ features, snapshot: { ...before, slices: { ...before.slices, checkpoint: { passedOnLevel: 2 } } } });
    sim.startLevel(3);
    expect(getCheckpoint(sim)!.isPassed).toBe(false);
    expect(getStickMan(sim).feet).toEqual(level3.start);
  });

  it('is kept by a snapshot: a restored game has it passed, and starts the stick man there after a death', () => {
    const sim = createSimOn(3);
    walkOffPaper(sim, 1);
    const restored = new Sim({ features, snapshot: sim.takeSnapshot() });
    expect(getCheckpoint(restored)!.isPassed).toBe(true);
    walkOffPaper(restored, 1);
    expect(getStickMan(restored).feet).toEqual(CHECKPOINT);
  });

  it('moves the stick man only while a level is being started: the player refuses to be moved like that once it is under way', () => {
    expect(() => startPlayerAt(createSimOn(3), CHECKPOINT)).toThrow(/init/);
  });

  it('is forgotten when the game starts over', () => {
    const sim = createSimOn(3);
    walkOffPaper(sim, 1);
    sim.startOver();
    sim.startLevel(3);
    expect(getCheckpoint(sim)!.isPassed).toBe(false);
    expect(getStickMan(sim).feet).toEqual(level3.start);
  });
});

// ---- Helpers ----

const CHECKPOINT = level3.checkpoint!;
const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };

function createSimOn(level: number): Sim {
  return new Sim({ features, start: { seed: 1, level } });
}

/** A sim on level 3 with the stick man standing still on the floor at `x`, as a snapshot has it. */
function createSimStandingAt(x: number): Sim {
  const before = createSimOn(3).takeSnapshot();
  return new Sim({ features, snapshot: { ...before, slices: { ...before.slices, player: { ...(before.slices.player as object), x } } } });
}

/** The stick man walks off the paper to one side, falls, and the level has started again: the stick man stands on the floor, still. */
function walkOffPaper(sim: Sim, direction: 1 | -1): void {
  sim.step([{ type: 'player/walk', direction }]);
  let ticks = 0;
  while (getStickMan(sim).feet.y <= 1) {
    sim.step();
    expect((ticks += 1)).toBeLessThan(3000);
  }
  while (getStickMan(sim).feet.y > 0) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}
