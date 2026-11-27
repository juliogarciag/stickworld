import { describe, expect, it } from 'vitest';
import { getLevelById, levels } from '../../content/levels';
import { STICK_MAN_HEIGHT, STICK_MAN_WIDTH } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { createSim, restoreSim } from '../../core/create';
import type { SimHandle } from '../../core/sim';
import type { SimSnapshot } from '../../core/snapshot';
import { MOVEMENT_PRESETS, PLAYER, type MovementTuning } from './defs';
import { keepOverTheLine } from './floor';
import type { PlayerState } from './state';
import { getStickMan } from './view';

describe('walking', () => {
  it('starts standing where the level starts, looking right', () => {
    const sim = createSim({ level: 1 });
    expect(getStickMan(sim)).toMatchObject({ feet: LEVEL.start, facing: 1, action: 'standing', distanceWalked: 0 });
  });

  it('walks right at the walk speed until told to stop', () => {
    const sim = createSim({ level: 1 });
    stepFor(sim, 60, [WALK_RIGHT]);
    const walked = getStickMan(sim);
    expect(walked.action).toBe('walking');
    expect(walked.feet.x - LEVEL.start.x).toBeCloseTo(PLAYER.walkSpeed, 6);
    expect(walked.distanceWalked).toBeCloseTo(PLAYER.walkSpeed, 6);

    stepFor(sim, 30, [STOP]);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', facing: 1, distanceWalked: 0 });
    expect(getStickMan(sim).feet.x).toBeCloseTo(walked.feet.x, 6);
  });

  it('turns and walks left', () => {
    const sim = createSim({ level: 1 });
    stepFor(sim, 20, [WALK_LEFT]);
    expect(getStickMan(sim)).toMatchObject({ facing: -1, action: 'walking' });
    expect(getStickMan(sim).feet.x).toBeLessThan(LEVEL.start.x);
  });

  it('ignores commands that are not well formed, without throwing', () => {
    const sim = createSim({ level: 1 });
    const malformed: unknown[] = [{ type: 'player/walk' }, { type: 'player/walk', direction: 2 }, { type: 'player/walk', direction: '1' }, { type: 'player/walk', direction: NaN }, { type: 'player/fly' }];
    stepFor(sim, 30, malformed as Command[]);
    expect(getStickMan(sim)).toMatchObject({ feet: LEVEL.start, action: 'standing' });
  });
});

describe('jumping', () => {
  it('lifts his feet to the jump height and brings him back to the floor', () => {
    const sim = createSim({ level: 1 });
    sim.step([JUMP]);
    expect(getStickMan(sim).action).toBe('jumping');
    const heights = [];
    while (getStickMan(sim).action === 'jumping') {
      heights.push(LEVEL.start.y - getStickMan(sim).feet.y);
      sim.step();
    }
    expect(Math.max(...heights)).toBeGreaterThan(PLAYER.jumpHeight * 0.98);
    expect(Math.max(...heights)).toBeLessThanOrEqual(PLAYER.jumpHeight + 1e-9);
    expect(getStickMan(sim)).toMatchObject({ feet: LEVEL.start, verticalSpeed: 0, action: 'standing' });
  });

  it('keeps walking through a jump', () => {
    const sim = createSim({ level: 1 });
    sim.step([WALK_RIGHT, JUMP]);
    const before = getStickMan(sim).feet.x;
    stepFor(sim, 10);
    expect(getStickMan(sim).action).toBe('jumping');
    expect(getStickMan(sim).feet.x - before).toBeCloseTo(10 * PLAYER.walkSpeed * sim.dt, 6);
  });

  it('does not jump again in the air', () => {
    const sim = createSim({ level: 1 });
    sim.step([JUMP]);
    stepFor(sim, 5);
    const rising = getStickMan(sim).verticalSpeed;
    sim.step([JUMP]);
    expect(getStickMan(sim).verticalSpeed).toBeGreaterThan(rising);
  });

  it('still jumps when asked the whole early window before landing', () => {
    const sim = createSimAboutToLand(EARLY_TICKS);
    sim.step([JUMP]);
    expect(doesJumpAgainWithin(sim, EARLY_TICKS + 2)).toBe(true);
  });

  it('forgets a jump asked for one tick more than the early window before landing', () => {
    const sim = createSimAboutToLand(EARLY_TICKS + 1);
    sim.step([JUMP]);
    expect(doesJumpAgainWithin(sim, 60)).toBe(false);
    expect(getStickMan(sim).action).toBe('standing');
  });

  it('still jumps when asked the whole late window after walking off an edge', () => {
    const sim = createSimJustWalkedOffTheEdge();
    stepFor(sim, LATE_TICKS - 1);
    expect(getStickMan(sim).verticalSpeed).toBeGreaterThan(0);
    sim.step([JUMP]);
    expect(getStickMan(sim).verticalSpeed).toBeLessThan(0);
  });

  it('does not jump when asked one tick more than the late window after walking off an edge', () => {
    const sim = createSimJustWalkedOffTheEdge();
    stepFor(sim, LATE_TICKS);
    sim.step([JUMP]);
    expect(getStickMan(sim).verticalSpeed).toBeGreaterThan(0);
  });
});

describe('momentum falling off an edge', () => {
  it('keeps the speed he walked off with, and with the key let go slows him to a stop almost at once', () => {
    const sim = createSimJustWalkedOffTheEdge();
    expect(getStickMan(sim).horizontalSpeed).toBe(-PLAYER.walkSpeed);
    sim.step([STOP]);
    expect(getStickMan(sim).horizontalSpeed).toBeCloseTo(-PLAYER.walkSpeed + PLAYER.airBraking * sim.dt, 9);
    stepFor(sim, Math.ceil(PLAYER.walkSpeed / (PLAYER.airBraking * sim.dt)));
    expect(getStickMan(sim)).toMatchObject({ action: 'jumping', fallingOffAnEdge: true, horizontalSpeed: 0, walkDirectionAsked: 0 });
  });

  it('lets the keys steer him only as fast as the air steering allows: the other way slows him, then turns him round', () => {
    // The small jump's air steering is slow enough to watch it a tick at a time.
    const sim = createSimJustWalkedOffTheEdge(MOVEMENT_PRESETS.smallJump);
    const { airSteering, walkSpeed } = MOVEMENT_PRESETS.smallJump;
    sim.step([WALK_RIGHT]);
    expect(getStickMan(sim).horizontalSpeed).toBeCloseTo(-walkSpeed + airSteering * sim.dt, 9);
    stepFor(sim, 9);
    expect(getStickMan(sim).horizontalSpeed).toBeCloseTo(-walkSpeed + 10 * airSteering * sim.dt, 9);
    stepFor(sim, Math.ceil(walkSpeed / (airSteering * sim.dt)));
    expect(getStickMan(sim).action).toBe('jumping');
    expect(getStickMan(sim).horizontalSpeed).toBeGreaterThanOrEqual(0);
  });

  it('never takes him past walk speed, however long the key is held', () => {
    const sim = createSimJustWalkedOffTheEdge();
    stepFor(sim, 20);
    expect(getStickMan(sim)).toMatchObject({ action: 'jumping', horizontalSpeed: -PLAYER.walkSpeed });
  });

  it('is not what a jump has: there the keys move him and stop him at once, as on the floor', () => {
    const sim = createSim({ level: 1 });
    sim.step([JUMP]);
    sim.step([WALK_RIGHT]);
    expect(getStickMan(sim)).toMatchObject({ action: 'jumping', fallingOffAnEdge: false, horizontalSpeed: PLAYER.walkSpeed });
    sim.step([STOP]);
    const stoppedAt = getStickMan(sim).feet.x;
    stepFor(sim, 5);
    expect(getStickMan(sim)).toMatchObject({ action: 'jumping', horizontalSpeed: 0 });
    expect(getStickMan(sim).feet.x).toBe(stoppedAt);
    sim.step([WALK_LEFT]);
    expect(getStickMan(sim).horizontalSpeed).toBe(-PLAYER.walkSpeed);
  });

  it('ends with a jump asked for just after the edge: from then on the keys move him at once', () => {
    const sim = createSimJustWalkedOffTheEdge();
    sim.step([JUMP]);
    expect(getStickMan(sim).verticalSpeed).toBeLessThan(0);
    sim.step([STOP]);
    expect(getStickMan(sim)).toMatchObject({ action: 'jumping', fallingOffAnEdge: false, horizontalSpeed: 0 });
  });
});

describe('dropping past the end of a floor line', () => {
  it('never leaves the end of a floor line inside his body, whatever he does', () => {
    for (const level of levels) {
      for (let pattern = 0; pattern < PATTERNS_PER_LEVEL; pattern += 1) {
        const sim = createSim({ level: level.id });
        for (let tick = 0; tick < 500; tick += 1) {
          sim.step(getCommandsOfPattern(pattern, tick));
          if (sim.level !== level.id) break;
          const { feet } = getStickMan(sim);
          for (const { from, to } of level.floor) {
            const reach = Math.max(getHalfWidthOfHisBody(feet.y - from.y), getHalfWidthOfHisBody(feet.y - to.y));
            const inside = feet.x > from.x - reach + 1e-9 && feet.x < to.x + reach - 1e-9;
            if (reach > 0 && inside) throw new Error(`level ${level.id}, pattern ${pattern}, tick ${tick}: his feet at (${feet.x}, ${feet.y}) leave the floor from ${from.x} to ${to.x} inside his body`);
          }
        }
      }
    }
  });

  it('is pushed aside by the end as he comes down beside it, a little every tick, until his whole width is clear of it', () => {
    const sim = createSimStandingAtTheEdge();
    const end = LEVEL.floor[0]!.from.x;
    // A hop with a touch outward, three ticks long: he comes down just past the end, straight.
    sim.step([JUMP, LET_GO]);
    stepFor(sim, 3, [WALK_LEFT]);
    sim.step([STOP]);
    const pastTheEnd = end - getStickMan(sim).feet.x;
    expect(pastTheEnd).toBeGreaterThan(0);
    expect(pastTheEnd).toBeLessThan(STICK_MAN_WIDTH / 2);
    expect(getStickMan(sim).horizontalSpeed).toBe(0);

    const besideTheEnd: number[] = [];
    for (let tick = 0; tick < 200 && getStickMan(sim).feet.y < PLAYER.fullWidthAbove; tick += 1) {
      if (getStickMan(sim).feet.y > 0) besideTheEnd.push(getStickMan(sim).feet.x);
      sim.step();
    }
    expect(besideTheEnd.length).toBeGreaterThan(3);
    // He was not moving sideways: the end of the line put him where he is.
    expect(getStickMan(sim).feet.x).toBeCloseTo(end - STICK_MAN_WIDTH / 2, 9);
    expect(getStickMan(sim).horizontalSpeed).toBe(0);
    for (let tick = 1; tick < besideTheEnd.length; tick += 1) expect(Math.abs(besideTheEnd[tick]! - besideTheEnd[tick - 1]!)).toBeLessThan(STICK_MAN_WIDTH / 4);
  });

  it('is stopped by the end of a line he walks into in a fall, and goes under it once his head has dropped below it', () => {
    const sim = createSim({ level: 2 });
    const farEnd = getLevelById(2).floor[1]!.from.x;
    sim.step([WALK_RIGHT]);
    // Narrow at his feet, the end pushes him back a little at a time; from his full width up it holds him where it is.
    while (getStickMan(sim).feet.y < PLAYER.fullWidthAbove) sim.step();
    expect(getStickMan(sim).feet.y).toBeLessThan(STICK_MAN_HEIGHT);
    expect(getStickMan(sim)).toMatchObject({ feet: { x: farEnd - STICK_MAN_WIDTH / 2 }, horizontalSpeed: 0 });
    while (getStickMan(sim).feet.y < STICK_MAN_HEIGHT) {
      expect(getStickMan(sim).feet.x).toBe(farEnd - STICK_MAN_WIDTH / 2);
      sim.step();
    }
    stepFor(sim, 10);
    expect(getStickMan(sim).feet.x).toBeGreaterThan(farEnd - STICK_MAN_WIDTH / 2);
  });

  it('is not pushed while he jumps over the end of the line', () => {
    const sim = createSim({ level: 1 });
    sim.step([WALK_LEFT]);
    const end = LEVEL.floor[0]!.from.x;
    while (getStickMan(sim).feet.x > end + 0.3) sim.step();
    sim.step([JUMP]);
    stepFor(sim, 3);
    expect(getStickMan(sim).feet.x).toBeGreaterThan(end);
    expect(getStickMan(sim).feet.x).toBeLessThan(end + STICK_MAN_WIDTH / 2);
    expect(getStickMan(sim).horizontalSpeed).toBe(-PLAYER.walkSpeed);
  });
});

describe('falling off the paper', () => {
  it('starts the level again', () => {
    const sim = createSimJustWalkedOffTheEdge();
    let lowest = 0;
    for (let tick = 0; tick < 300 && getStickMan(sim).action === 'jumping'; tick += 1) {
      lowest = Math.max(lowest, getStickMan(sim).feet.y);
      sim.step();
    }
    expect(lowest).toBeGreaterThan(PLAYER.fallBelowFloor - 1);
    expect(getStickMan(sim)).toMatchObject({ feet: LEVEL.start, verticalSpeed: 0 });
    expect(sim.level).toBe(1);
  });
});

describe('the player state', () => {
  it('continues from a snapshot taken in the middle of a jump exactly as the original does', () => {
    const original = createSim({ level: 1 });
    original.step([WALK_RIGHT, JUMP]);
    stepFor(original, 7);
    const restored = restoreSim(original.takeSnapshot());
    stepFor(original, 40);
    stepFor(restored, 40);
    expect(restored.takeSnapshot()).toEqual(original.takeSnapshot());
  });
});

describe('keepOverTheLine', () => {
  it('lets a step end where it was going while that is over his line, half his width from its ends at the nearest', () => {
    expect(keepOverTheLine(TWO_LINES, { from: 22, to: 22.04 })).toBe(22.04);
    expect(keepOverTheLine(TWO_LINES, { from: 26.9, to: 27.5 })).toBe(27 - STICK_MAN_WIDTH / 2);
    expect(keepOverTheLine(TWO_LINES, { from: 19.1, to: 18 })).toBe(19 + STICK_MAN_WIDTH / 2);
    // The line he is on is the one that counts, not the other.
    expect(keepOverTheLine(TWO_LINES, { from: 9.9, to: 12 })).toBe(10 - STICK_MAN_WIDTH / 2);
  });

  it('changes nothing for him who has no line under him', () => {
    expect(keepOverTheLine(TWO_LINES, { from: 14, to: 14.5 })).toBe(14.5);
    expect(keepOverTheLine(TWO_LINES, { from: -1, to: -2 })).toBe(-2);
  });
});

// ---- Helpers ----

/** Two floor lines with a gap between them, as level 3 has. */
const TWO_LINES = [
  { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
  { from: { x: 19, y: 0 }, to: { x: 27, y: 0 } },
];

const LEVEL = getLevelById(1);
const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };
const WALK_LEFT: Command = { type: 'player/walk', direction: -1 };
const STOP: Command = { type: 'player/walk', direction: 0 };
const JUMP: Command = { type: 'player/jump' };
const LET_GO: Command = { type: 'player/letGoOfJump' };
const DT = createSim({ level: 1 }).dt;
const EARLY_TICKS = Math.round(PLAYER.jumpAskedEarlyWindow / DT);
const LATE_TICKS = Math.round(PLAYER.jumpAskedLateWindow / DT);

/** Enough different ways of pressing the keys that he leaves every edge walking, drifting, steering back and jumping. */
const PATTERNS_PER_LEVEL = 240;

/**
 * What the player presses on `tick` in pattern number `pattern`: he sets off one way, and from some tick on changes
 * direction or jumps every few ticks. Worked out from the two numbers alone, so every run plays the same.
 */
function getCommandsOfPattern(pattern: number, tick: number): Command[] {
  const setsOff = pattern % 2 === 0 ? WALK_RIGHT : WALK_LEFT;
  if (tick === 0) return [setsOff];
  const every = 3 + (pattern % 7);
  const startsAt = 20 + ((pattern * 13) % 110);
  if (tick < startsAt || (tick - startsAt) % every !== 0) return [];
  const turn = (pattern * 31 + ((tick - startsAt) / every) * 17) % 5;
  return [[WALK_LEFT], [WALK_RIGHT], [STOP], [JUMP], [setsOff, JUMP]][turn]!;
}

/** His body as the tuning describes it, worked out here again so the test does not lean on the code it checks. */
function getHalfWidthOfHisBody(aboveFeet: number): number {
  if (aboveFeet <= 0 || aboveFeet >= STICK_MAN_HEIGHT) return 0;
  return (STICK_MAN_WIDTH / 2) * Math.min(1, aboveFeet / PLAYER.fullWidthAbove);
}

/** Steps `ticks` times, with `commands` on the first tick only. */
function stepFor(sim: SimHandle, ticks: number, commands: readonly Command[] = []): void {
  for (let tick = 0; tick < ticks; tick += 1) sim.step(tick === 0 ? commands : []);
}

/** A sim in which he is coming down from a jump and lands `ticks` ticks from now. */
function createSimAboutToLand(ticks: number): SimHandle {
  const sim = createSim({ level: 1 });
  sim.step([JUMP]);
  const airborne: SimSnapshot[] = [];
  while (getStickMan(sim).action === 'jumping') {
    airborne.push(sim.takeSnapshot());
    sim.step();
  }
  return restoreSim(airborne[airborne.length - ticks]!);
}

/** True when he lands and takes off again within `ticks` ticks, without another command. */
function doesJumpAgainWithin(sim: SimHandle, ticks: number): boolean {
  let landed = false;
  for (let tick = 0; tick < ticks; tick += 1) {
    sim.step();
    const { verticalSpeed } = getStickMan(sim);
    if (verticalSpeed === 0) landed = true;
    // He takes off in the same tick he lands, so a rise after a fall is the jump.
    if (verticalSpeed < 0) return true;
  }
  return landed && getStickMan(sim).action === 'jumping';
}

/** A sim in which he has walked left off the start of the floor, this very tick, moving as `tuning` says. */
function createSimJustWalkedOffTheEdge(tuning: MovementTuning = MOVEMENT_PRESETS.current): SimHandle {
  const sim = createSim({ level: 1 });
  sim.step([{ type: 'player/tuneMovement', tuning }, WALK_LEFT]);
  for (let tick = 0; tick < 600 && getPlayerIn(sim).onFloor; tick += 1) sim.step();
  expect(getPlayerIn(sim)).toMatchObject({ onFloor: false, ticksSinceWalkedOff: 0 });
  return sim;
}

/** A sim in which he stands still on the last bit of floor before its start, having walked left to it. */
function createSimStandingAtTheEdge(): SimHandle {
  const sim = createSim({ level: 1 });
  sim.step([WALK_LEFT]);
  while (getStickMan(sim).feet.x - 2 * PLAYER.walkSpeed * sim.dt >= LEVEL.floor[0]!.from.x) sim.step();
  sim.step([STOP]);
  expect(getStickMan(sim).action).toBe('standing');
  expect(getStickMan(sim).feet.x).toBeLessThan(LEVEL.floor[0]!.from.x + 0.1);
  return sim;
}

function getPlayerIn(sim: SimHandle): PlayerState {
  return sim.takeSnapshot().slices.player as PlayerState;
}
