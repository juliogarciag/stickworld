import { describe, expect, it } from 'vitest';
import { levelById, levels } from '../../content/levels';
import { STICK_MAN_HEIGHT, STICK_MAN_WIDTH } from '../../content/tuning';
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

  it('still jumps when asked the whole early window before landing', () => {
    const sim = aboutToLand(EARLY_TICKS);
    sim.step([JUMP]);
    expect(jumpsAgainWithin(sim, EARLY_TICKS + 2)).toBe(true);
  });

  it('forgets a jump asked for one tick more than the early window before landing', () => {
    const sim = aboutToLand(EARLY_TICKS + 1);
    sim.step([JUMP]);
    expect(jumpsAgainWithin(sim, 60)).toBe(false);
    expect(stickManOf(sim).action).toBe('standing');
  });

  it('still jumps when asked the whole late window after walking off an edge', () => {
    const sim = justWalkedOffTheEdge();
    stepFor(sim, LATE_TICKS - 1);
    expect(stickManOf(sim).verticalSpeed).toBeGreaterThan(0);
    sim.step([JUMP]);
    expect(stickManOf(sim).verticalSpeed).toBeLessThan(0);
  });

  it('does not jump when asked one tick more than the late window after walking off an edge', () => {
    const sim = justWalkedOffTheEdge();
    stepFor(sim, LATE_TICKS);
    sim.step([JUMP]);
    expect(stickManOf(sim).verticalSpeed).toBeGreaterThan(0);
  });
});

describe('momentum falling off an edge', () => {
  it('carries him forward after he walks off an edge and the key is let go', () => {
    const sim = justWalkedOffTheEdge();
    sim.step([STOP]);
    const from = stickManOf(sim).feet.x;
    stepFor(sim, 20);
    expect(stickManOf(sim)).toMatchObject({ action: 'jumping', horizontalSpeed: -PLAYER.walkSpeed, walkDirectionAsked: 0 });
    expect(stickManOf(sim).feet.x - from).toBeCloseTo(-20 * PLAYER.walkSpeed * sim.dt, 6);
  });

  it('lets the keys steer him only as fast as the air steering allows: the other way slows him, then turns him round', () => {
    const sim = justWalkedOffTheEdge();
    sim.step([WALK_RIGHT]);
    expect(stickManOf(sim).horizontalSpeed).toBeCloseTo(-PLAYER.walkSpeed + PLAYER.airSteering * sim.dt, 9);
    stepFor(sim, 9);
    expect(stickManOf(sim).horizontalSpeed).toBeCloseTo(-PLAYER.walkSpeed + 10 * PLAYER.airSteering * sim.dt, 9);
    stepFor(sim, Math.ceil(PLAYER.walkSpeed / (PLAYER.airSteering * sim.dt)));
    expect(stickManOf(sim).action).toBe('jumping');
    expect(stickManOf(sim).horizontalSpeed).toBeGreaterThanOrEqual(0);
  });

  it('never takes him past walk speed, however long the key is held', () => {
    const sim = justWalkedOffTheEdge();
    stepFor(sim, 20);
    expect(stickManOf(sim)).toMatchObject({ action: 'jumping', horizontalSpeed: -PLAYER.walkSpeed });
  });

  it('is not what a jump has: there the keys move him and stop him at once, as on the floor', () => {
    const sim = createSim({ level: 1 });
    sim.step([JUMP]);
    sim.step([WALK_RIGHT]);
    expect(stickManOf(sim)).toMatchObject({ action: 'jumping', horizontalSpeed: PLAYER.walkSpeed });
    sim.step([STOP]);
    const stoppedAt = stickManOf(sim).feet.x;
    stepFor(sim, 5);
    expect(stickManOf(sim)).toMatchObject({ action: 'jumping', horizontalSpeed: 0 });
    expect(stickManOf(sim).feet.x).toBe(stoppedAt);
    sim.step([WALK_LEFT]);
    expect(stickManOf(sim).horizontalSpeed).toBe(-PLAYER.walkSpeed);
  });

  it('ends with a jump asked for just after the edge: from then on the keys move him at once', () => {
    const sim = justWalkedOffTheEdge();
    sim.step([JUMP]);
    expect(stickManOf(sim).verticalSpeed).toBeLessThan(0);
    sim.step([STOP]);
    expect(stickManOf(sim)).toMatchObject({ action: 'jumping', horizontalSpeed: 0 });
  });
});

describe('dropping past the end of a floor line', () => {
  it('never leaves the end of a floor line inside his body, whatever he does', () => {
    for (const level of levels) {
      for (let pattern = 0; pattern < PATTERNS_PER_LEVEL; pattern += 1) {
        const sim = createSim({ level: level.id });
        for (let tick = 0; tick < 500; tick += 1) {
          sim.step(commandsOfPattern(pattern, tick));
          if (sim.level !== level.id) break;
          const { feet } = stickManOf(sim);
          for (const { from, to } of level.floor) {
            const reach = Math.max(halfWidthOfHisBody(feet.y - from.y), halfWidthOfHisBody(feet.y - to.y));
            const inside = feet.x > from.x - reach + 1e-9 && feet.x < to.x + reach - 1e-9;
            if (reach > 0 && inside) throw new Error(`level ${level.id}, pattern ${pattern}, tick ${tick}: his feet at (${feet.x}, ${feet.y}) leave the floor from ${from.x} to ${to.x} inside his body`);
          }
        }
      }
    }
  });

  it('is pushed aside by the end as he comes down beside it, a little every tick, until his whole width is clear of it', () => {
    const sim = standingAtTheEdge();
    const end = LEVEL.floor[0]!.from.x;
    // A hop with a touch outward, three ticks long: he comes down just past the end, straight.
    sim.step([JUMP]);
    stepFor(sim, 3, [WALK_LEFT]);
    sim.step([STOP]);
    const pastTheEnd = end - stickManOf(sim).feet.x;
    expect(pastTheEnd).toBeGreaterThan(0);
    expect(pastTheEnd).toBeLessThan(STICK_MAN_WIDTH / 2);
    expect(stickManOf(sim).horizontalSpeed).toBe(0);

    const besideTheEnd: number[] = [];
    for (let tick = 0; tick < 200 && stickManOf(sim).feet.y < PLAYER.fullWidthAbove; tick += 1) {
      if (stickManOf(sim).feet.y > 0) besideTheEnd.push(stickManOf(sim).feet.x);
      sim.step();
    }
    expect(besideTheEnd.length).toBeGreaterThan(3);
    // He was not moving sideways: the end of the line put him where he is.
    expect(stickManOf(sim).feet.x).toBeCloseTo(end - STICK_MAN_WIDTH / 2, 9);
    expect(stickManOf(sim).horizontalSpeed).toBe(0);
    for (let tick = 1; tick < besideTheEnd.length; tick += 1) expect(Math.abs(besideTheEnd[tick]! - besideTheEnd[tick - 1]!)).toBeLessThan(STICK_MAN_WIDTH / 4);
  });

  it('is stopped by the end of a line he drifts into, and goes under it once his head has dropped below it', () => {
    const sim = createSim({ level: 2 });
    const farEnd = levelById(2).floor[1]!.from.x;
    sim.step([WALK_RIGHT]);
    while (stickManOf(sim).feet.y <= 0 || stickManOf(sim).feet.x < farEnd - STICK_MAN_WIDTH / 2 - 1e-9) sim.step();
    expect(stickManOf(sim).feet.y).toBeLessThan(STICK_MAN_HEIGHT);
    expect(stickManOf(sim)).toMatchObject({ feet: { x: farEnd - STICK_MAN_WIDTH / 2 }, horizontalSpeed: 0 });
    while (stickManOf(sim).feet.y < STICK_MAN_HEIGHT) {
      expect(stickManOf(sim).feet.x).toBe(farEnd - STICK_MAN_WIDTH / 2);
      sim.step();
    }
    stepFor(sim, 10);
    expect(stickManOf(sim).feet.x).toBeGreaterThan(farEnd - STICK_MAN_WIDTH / 2);
  });

  it('is not pushed while he jumps over the end of the line', () => {
    const sim = createSim({ level: 1 });
    sim.step([WALK_LEFT]);
    const end = LEVEL.floor[0]!.from.x;
    while (stickManOf(sim).feet.x > end + 0.3) sim.step();
    sim.step([JUMP]);
    stepFor(sim, 3);
    expect(stickManOf(sim).feet.x).toBeGreaterThan(end);
    expect(stickManOf(sim).feet.x).toBeLessThan(end + STICK_MAN_WIDTH / 2);
    expect(stickManOf(sim).horizontalSpeed).toBe(-PLAYER.walkSpeed);
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
const DT = createSim({ level: 1 }).dt;
const EARLY_TICKS = Math.round(PLAYER.jumpAskedEarlyWindow / DT);
const LATE_TICKS = Math.round(PLAYER.jumpAskedLateWindow / DT);

/** Enough different ways of pressing the keys that he leaves every edge walking, drifting, steering back and jumping. */
const PATTERNS_PER_LEVEL = 240;

/**
 * What the player presses on `tick` in pattern number `pattern`: he sets off one way, and from some tick on changes
 * direction or jumps every few ticks. Worked out from the two numbers alone, so every run plays the same.
 */
function commandsOfPattern(pattern: number, tick: number): Command[] {
  const setsOff = pattern % 2 === 0 ? WALK_RIGHT : WALK_LEFT;
  if (tick === 0) return [setsOff];
  const every = 3 + (pattern % 7);
  const startsAt = 20 + ((pattern * 13) % 110);
  if (tick < startsAt || (tick - startsAt) % every !== 0) return [];
  const turn = (pattern * 31 + ((tick - startsAt) / every) * 17) % 5;
  return [[WALK_LEFT], [WALK_RIGHT], [STOP], [JUMP], [setsOff, JUMP]][turn]!;
}

/** His body as the tuning describes it, worked out here again so the test does not lean on the code it checks. */
function halfWidthOfHisBody(aboveFeet: number): number {
  if (aboveFeet <= 0 || aboveFeet >= STICK_MAN_HEIGHT) return 0;
  return (STICK_MAN_WIDTH / 2) * Math.min(1, aboveFeet / PLAYER.fullWidthAbove);
}

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

/** A sim in which he stands still on the last bit of floor before its start, having walked left to it. */
function standingAtTheEdge(): SimHandle {
  const sim = createSim({ level: 1 });
  sim.step([WALK_LEFT]);
  while (stickManOf(sim).feet.x - 2 * PLAYER.walkSpeed * sim.dt >= LEVEL.floor[0]!.from.x) sim.step();
  sim.step([STOP]);
  expect(stickManOf(sim).action).toBe('standing');
  expect(stickManOf(sim).feet.x).toBeLessThan(LEVEL.floor[0]!.from.x + 0.1);
  return sim;
}

function playerIn(sim: SimHandle): PlayerState {
  return sim.snapshot().slices.player as PlayerState;
}
