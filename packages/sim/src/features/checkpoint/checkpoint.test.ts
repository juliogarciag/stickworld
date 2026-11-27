import { describe, expect, it } from 'vitest';
import { level3 } from '../../content/levels/level3';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { startPlayerAt } from '../player/body';
import { getStickMan } from '../player/view';
import { getCheckpoint } from './view';

describe('the checkpoint', () => {
  it('is at the position the level gives and not passed at first, and a level without one has none', () => {
    expect(getCheckpoint(createSimOn(3))).toEqual({ position: CHECKPOINT, isPassed: false });
    expect(getCheckpoint(createSimOn(1))).toBeUndefined();
  });

  it('is passed on the tick the stick man stands at or past the checkpoint, and not before', () => {
    const sim = createSimOn(3);
    sim.step([WALK_RIGHT]);
    while (getStickMan(sim).feet.x < CHECKPOINT.x) {
      expect(getCheckpoint(sim)!.isPassed).toBe(false);
      sim.step();
    }
    expect(getCheckpoint(sim)!.isPassed).toBe(true);
  });

  it('is passed by standing exactly at the checkpoint, and not by standing just short of it', () => {
    const sim = createSimStandingAt(CHECKPOINT.x);
    expect(getCheckpoint(sim)!.isPassed).toBe(false);
    sim.step();
    expect(getCheckpoint(sim)!.isPassed).toBe(true);
    const oneStepShort = createSimStandingAt(CHECKPOINT.x - 0.01);
    oneStepShort.step();
    expect(getCheckpoint(oneStepShort)!.isPassed).toBe(false);
  });

  it('is not passed by a jump over the checkpoint until the stick man lands past it', () => {
    const sim = createSimOn(3);
    sim.step([WALK_RIGHT]);
    while (getStickMan(sim).feet.x < CHECKPOINT.x - 0.3) {
      sim.step();
    }
    sim.step([{ type: 'player/jump' }]);
    while (getStickMan(sim).action === 'jumping') {
      if (getStickMan(sim).feet.x >= CHECKPOINT.x) {
        expect(getCheckpoint(sim)!.isPassed).toBe(false);
      }
      sim.step();
    }
    // The loop ends on the tick the stick man lands, which is the tick the checkpoint is passed.
    expect(getStickMan(sim).feet.x).toBeGreaterThan(CHECKPOINT.x);
    expect(getCheckpoint(sim)!.isPassed).toBe(true);
  });

  it('restarts the level at its start after a death before the checkpoint', () => {
    const sim = createSimOn(3);
    walkOffPaper(sim, -1);
    expect(getCheckpoint(sim)!.isPassed).toBe(false);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: level3.start });
  });

  it('restarts the level at the checkpoint after a death past it, with the stick man standing still, and stays passed through several deaths', () => {
    const sim = createSimOn(3);
    for (let death = 1; death <= 3; death += 1) {
      walkOffPaper(sim, 1);
      expect(getCheckpoint(sim)!.isPassed, `death ${death}`).toBe(true);
      expect(getStickMan(sim), `death ${death}`).toMatchObject({
        action: 'standing',
        feet: CHECKPOINT,
        verticalSpeed: 0,
        horizontalSpeed: 0,
        isCarrying: false,
      });
    }
  });

  it('is forgotten when another level starts: back on the first level later, the stick man begins at the level start', () => {
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
    const sim = new Sim({
      features,
      snapshot: { ...before, slices: { ...before.slices, checkpoint: { passedOnLevel: 2 } } },
    });
    sim.startLevel(3);
    expect(getCheckpoint(sim)!.isPassed).toBe(false);
    expect(getStickMan(sim).feet).toEqual(level3.start);
  });

  it('is kept by a snapshot: a restored game has the checkpoint passed and restarts there after a death', () => {
    const sim = createSimOn(3);
    walkOffPaper(sim, 1);
    const restored = new Sim({ features, snapshot: sim.takeSnapshot() });
    expect(getCheckpoint(restored)!.isPassed).toBe(true);
    walkOffPaper(restored, 1);
    expect(getStickMan(restored).feet).toEqual(CHECKPOINT);
  });

  it('moves the stick man only while a level is being started: startPlayerAt throws once the level is under way', () => {
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
  return new Sim({
    features,
    snapshot: {
      ...before,
      slices: { ...before.slices, player: { ...(before.slices.player as object), x } },
    },
  });
}

/** Walks the stick man off the paper to one side and steps until the level has restarted and the stick man stands still on the floor. */
function walkOffPaper(sim: Sim, direction: 1 | -1): void {
  sim.step([{ type: 'player/walk', direction }]);
  let ticks = 0;
  while (getStickMan(sim).feet.y <= 1) {
    sim.step();
    expect((ticks += 1)).toBeLessThan(3000);
  }
  while (getStickMan(sim).feet.y > 0) {
    sim.step();
  }
  sim.step([{ type: 'player/walk', direction: 0 }]);
}
