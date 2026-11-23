import { describe, expect, it } from 'vitest';
import { levelById } from '../../content/levels';
import type { Command } from '../../core/commands';
import { createSim, restoreSim } from '../../core/create';
import type { SimHandle } from '../../core/sim';
import type { SimSnapshot } from '../../core/snapshot';
import { PLAYER } from './defs';
import type { PlayerState } from './state';
import { stickManOf } from './view';

describe('walking', () => {
  it('starts standing where the level starts, looking right', () => {
    const sim = createSim({ level: 1 });
    expect(stickManOf(sim)).toMatchObject({ feet: LEVEL.start, facing: 1, action: 'standing', distanceWalked: 0 });
  });

  it('walks right at the walk speed until told to stop', () => {
    const sim = createSim({ level: 1 });
    stepFor(sim, 60, [WALK_RIGHT]);
    const walked = stickManOf(sim);
    expect(walked.action).toBe('walking');
    expect(walked.feet.x - LEVEL.start.x).toBeCloseTo(PLAYER.walkSpeed, 6);
    expect(walked.distanceWalked).toBeCloseTo(PLAYER.walkSpeed, 6);

    stepFor(sim, 30, [STOP]);
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', facing: 1, distanceWalked: 0 });
    expect(stickManOf(sim).feet.x).toBeCloseTo(walked.feet.x, 6);
  });

  it('turns and walks left', () => {
    const sim = createSim({ level: 1 });
    stepFor(sim, 20, [WALK_LEFT]);
    expect(stickManOf(sim)).toMatchObject({ facing: -1, action: 'walking' });
    expect(stickManOf(sim).feet.x).toBeLessThan(LEVEL.start.x);
  });

  it('ignores commands that are not well formed, without throwing', () => {
    const sim = createSim({ level: 1 });
    const malformed: unknown[] = [{ type: 'player/walk' }, { type: 'player/walk', direction: 2 }, { type: 'player/walk', direction: '1' }, { type: 'player/walk', direction: NaN }, { type: 'player/fly' }];
    stepFor(sim, 30, malformed as Command[]);
    expect(stickManOf(sim)).toMatchObject({ feet: LEVEL.start, action: 'standing' });
  });
});

describe('jumping', () => {
  it('lifts his feet to the jump height and brings him back to the floor', () => {
    const sim = createSim({ level: 1 });
    sim.step([JUMP]);
    expect(stickManOf(sim).action).toBe('jumping');
    const heights = [];
    while (stickManOf(sim).action === 'jumping') {
      heights.push(LEVEL.start.y - stickManOf(sim).feet.y);
      sim.step();
    }
    expect(Math.max(...heights)).toBeGreaterThan(PLAYER.jumpHeight * 0.98);
    expect(Math.max(...heights)).toBeLessThanOrEqual(PLAYER.jumpHeight + 1e-9);
    expect(stickManOf(sim)).toMatchObject({ feet: LEVEL.start, verticalSpeed: 0, action: 'standing' });
  });

  it('keeps walking through a jump', () => {
    const sim = createSim({ level: 1 });
    sim.step([WALK_RIGHT, JUMP]);
    const before = stickManOf(sim).feet.x;
    stepFor(sim, 10);
    expect(stickManOf(sim).action).toBe('jumping');
    expect(stickManOf(sim).feet.x - before).toBeCloseTo(10 * PLAYER.walkSpeed * sim.dt, 6);
  });

  it('does not jump again in the air', () => {
    const sim = createSim({ level: 1 });
    sim.step([JUMP]);
    stepFor(sim, 5);
    const rising = stickManOf(sim).verticalSpeed;
    sim.step([JUMP]);
    expect(stickManOf(sim).verticalSpeed).toBeGreaterThan(rising);
  });

  it('still jumps when asked just before landing', () => {
    const sim = aboutToLand(EARLY_TICKS);
    sim.step([JUMP]);
    expect(jumpsAgainWithin(sim, EARLY_TICKS + 2)).toBe(true);
  });

  it('forgets a jump asked for too long before landing', () => {
    const sim = aboutToLand(EARLY_TICKS + 3);
    sim.step([JUMP]);
    expect(jumpsAgainWithin(sim, 60)).toBe(false);
    expect(stickManOf(sim).action).toBe('standing');
  });

  it('still jumps when asked just after walking off an edge', () => {
    const sim = justWalkedOffTheEdge();
    stepFor(sim, LATE_TICKS - 1);
    expect(stickManOf(sim).verticalSpeed).toBeGreaterThan(0);
    sim.step([JUMP]);
    expect(stickManOf(sim).verticalSpeed).toBeLessThan(0);
  });

  it('does not jump when asked too long after walking off an edge', () => {
    const sim = justWalkedOffTheEdge();
    stepFor(sim, LATE_TICKS + 2);
    sim.step([JUMP]);
    expect(stickManOf(sim).verticalSpeed).toBeGreaterThan(0);
  });
});

describe('falling off the paper', () => {
  it('starts the level again', () => {
    const sim = justWalkedOffTheEdge();
    let lowest = 0;
    for (let tick = 0; tick < 300 && stickManOf(sim).action === 'jumping'; tick += 1) {
      lowest = Math.max(lowest, stickManOf(sim).feet.y);
      sim.step();
    }
    expect(lowest).toBeGreaterThan(PLAYER.fallBelowFloor - 1);
    expect(stickManOf(sim)).toMatchObject({ feet: LEVEL.start, verticalSpeed: 0 });
    expect(sim.level).toBe(1);
  });
});

describe('the player state', () => {
  it('continues from a snapshot taken in the middle of a jump exactly as the original does', () => {
    const original = createSim({ level: 1 });
    original.step([WALK_RIGHT, JUMP]);
    stepFor(original, 7);
    const restored = restoreSim(original.snapshot());
    stepFor(original, 40);
    stepFor(restored, 40);
    expect(restored.snapshot()).toEqual(original.snapshot());
  });
});

// ---- Helpers ----

const LEVEL = levelById(1);
const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };
const WALK_LEFT: Command = { type: 'player/walk', direction: -1 };
const STOP: Command = { type: 'player/walk', direction: 0 };
const JUMP: Command = { type: 'player/jump' };
const TICK = createSim({ level: 1 }).dt;
const EARLY_TICKS = Math.round(PLAYER.jumpAskedEarlyWindow / TICK);
const LATE_TICKS = Math.round(PLAYER.jumpAskedLateWindow / TICK);

/** Steps `ticks` times, with `commands` on the first tick only. */
function stepFor(sim: SimHandle, ticks: number, commands: readonly Command[] = []): void {
  for (let tick = 0; tick < ticks; tick += 1) sim.step(tick === 0 ? commands : []);
}

/** A sim in which he is coming down from a jump and lands `ticks` ticks from now. */
function aboutToLand(ticks: number): SimHandle {
  const sim = createSim({ level: 1 });
  sim.step([JUMP]);
  const airborne: SimSnapshot[] = [];
  while (stickManOf(sim).action === 'jumping') {
    airborne.push(sim.snapshot());
    sim.step();
  }
  return restoreSim(airborne[airborne.length - ticks]!);
}

/** True when he lands and takes off again within `ticks` ticks, without another command. */
function jumpsAgainWithin(sim: SimHandle, ticks: number): boolean {
  let landed = false;
  for (let tick = 0; tick < ticks; tick += 1) {
    sim.step();
    const { verticalSpeed } = stickManOf(sim);
    if (verticalSpeed === 0) landed = true;
    // He takes off in the same tick he lands, so a rise after a fall is the jump.
    if (verticalSpeed < 0) return true;
  }
  return landed && stickManOf(sim).action === 'jumping';
}

/** A sim in which he has walked left off the start of the floor, this very tick. */
function justWalkedOffTheEdge(): SimHandle {
  const sim = createSim({ level: 1 });
  sim.step([WALK_LEFT]);
  for (let tick = 0; tick < 600 && playerIn(sim).onFloor; tick += 1) sim.step();
  expect(playerIn(sim)).toMatchObject({ onFloor: false, ticksSinceWalkedOff: 0 });
  return sim;
}

function playerIn(sim: SimHandle): PlayerState {
  return sim.snapshot().slices.player as PlayerState;
}
