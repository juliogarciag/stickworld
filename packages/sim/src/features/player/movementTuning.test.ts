import { describe, expect, it } from 'vitest';
import { getLevelById, levels } from '../../content/levels';
import type { Command } from '../../core/commands';
import { createSim, restoreSim } from '../../core/create';
import type { Sim, SimHandle } from '../../core/sim';
import { hashSnapshot } from '../../core/snapshot';
import { MOVEMENT_PRESETS, MOVEMENT_TUNING_LIMITS, PLAYER, type MovementTuning } from './defs';
import type { PlayerState } from './state';
import { getMovementTuning, getStickMan } from './view';

describe('the movement a game nobody tunes plays', () => {
  it('is the current preset, which is PLAYER as it is', () => {
    expect(getMovementTuning(createSim({ level: 1 }))).toEqual(MOVEMENT_PRESETS.current);
    expect(MOVEMENT_PRESETS.current).toEqual({
      walkSpeed: PLAYER.walkSpeed,
      jumpHeight: PLAYER.jumpHeight,
      jumpHeightCarrying: PLAYER.jumpHeightCarrying,
      riseGravity: PLAYER.riseGravity,
      fallGravity: PLAYER.fallGravity,
      fastestFall: PLAYER.fastestFall,
      letGoCut: PLAYER.letGoCut,
      airSteering: PLAYER.airSteering,
      airBraking: PLAYER.airBraking,
    });
  });

  it('is the two metre jump the owner tuned in the panel', () => {
    expect(MOVEMENT_PRESETS.current).toEqual({
      walkSpeed: 2.2,
      jumpHeight: 2,
      jumpHeightCarrying: 0.7,
      riseGravity: 20,
      fallGravity: 20,
      fastestFall: 10,
      letGoCut: 1,
      airSteering: 100,
      airBraking: 100,
    });
  });

  it('jumps two metres when held, and less the sooner it is let go of: a tap is a short hop', () => {
    const heights = [0, 4, 10, 20, null].map((letGoAfter) =>
      measureHighestJump(createSim({ level: 1 }), { letGoAfter }),
    );
    for (let index = 1; index < heights.length; index += 1) {
      expect(heights[index]).toBeGreaterThan(heights[index - 1]!);
    }
    expect(heights.at(-1)).toBeGreaterThan(PLAYER.jumpHeight * 0.97);
    expect(heights.at(-1)).toBeLessThanOrEqual(PLAYER.jumpHeight + 1e-9);
    expect(heights[0]).toBeGreaterThan(0);
    expect(heights[0]).toBeLessThan(0.25);
    expect(heights[1]).toBeLessThan(PLAYER.jumpHeight / 2);
  });

  it('rises and falls evenly, and falls no faster than its fastest fall', () => {
    const jump = recordJumpOf(createSim({ level: 1 }), { letGoAfter: null });
    expect(Math.abs(jump.ticksDown - jump.ticksToTop)).toBeLessThanOrEqual(2);
    const sim = walkOffStart(createSim({ level: 1 }));
    let fastest = 0;
    for (let tick = 0; tick < 240 && sim.level === 1; tick += 1) {
      sim.step();
      fastest = Math.max(fastest, getStickMan(sim).verticalSpeed);
    }
    expect(fastest).toBe(PLAYER.fastestFall);
  });

  it('stops the stick man almost at once in a fall off an edge when no key is held, and turns the stick man almost at once when one is', () => {
    const stopped = walkOffStart(createSim({ level: 1 }));
    stopped.step([STOP]);
    expect(getStickMan(stopped).horizontalSpeed).toBeCloseTo(
      -PLAYER.walkSpeed + PLAYER.airBraking * stopped.dt,
      9,
    );
    stepFor(stopped, Math.ceil(PLAYER.walkSpeed / (PLAYER.airBraking * stopped.dt)));
    expect(getStickMan(stopped).horizontalSpeed).toBe(0);
    // The other way, a held key changes the stick man's speed as fast: from walking one way to the other in a tenth of a second.
    const turned = walkOffStart(createSim({ level: 1 }));
    turned.step([WALK_RIGHT]);
    expect(getStickMan(turned).horizontalSpeed).toBeCloseTo(
      -PLAYER.walkSpeed + PLAYER.airSteering * turned.dt,
      9,
    );
    expect((2 * PLAYER.walkSpeed) / PLAYER.airSteering).toBeLessThan(0.1);
  });

  it("crosses level 2's gap with a running jump and falls into level 3's", () => {
    for (const [level, doesCross] of [
      [2, true],
      [3, false],
    ] as const) {
      const floor = getLevelById(level).floor;
      const sim = createSim({ level });
      sim.step([WALK_RIGHT]);
      // The last tick on the floor before the edge, then a held jump.
      while (getStickMan(sim).feet.x + 2 * PLAYER.walkSpeed * sim.dt < floor[0]!.end.x) {
        sim.step();
      }
      sim.step([JUMP]);
      stepFor(sim, 120);
      const hasLandedOnFarSide =
        sim.level === level &&
        getStickMan(sim).feet.x >= floor[1]!.start.x &&
        getStickMan(sim).action !== 'jumping';
      expect(hasLandedOnFarSide, `level ${level}`).toBe(doesCross);
    }
  });

  it('presets and limits agree: every preset is within the limits', () => {
    for (const preset of Object.values(MOVEMENT_PRESETS)) {
      for (const [name, value] of Object.entries(preset)) {
        const { min, max } = MOVEMENT_TUNING_LIMITS[name as keyof MovementTuning];
        expect(value, name).toBeGreaterThanOrEqual(min);
        expect(value, name).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe('the small jump preset, the jump the game had before the two metre one', () => {
  it("jumps well under the stick man's height, as high whether or not the jump is let go of", () => {
    const held = measureHighestJump(createTunedSim(MOVEMENT_PRESETS.smallJump), {
      letGoAfter: null,
    });
    expect(held).toBe(
      measureHighestJump(createTunedSim(MOVEMENT_PRESETS.smallJump), { letGoAfter: 0 }),
    );
    expect(held).toBeGreaterThan(MOVEMENT_PRESETS.smallJump.jumpHeight * 0.97);
    expect(held).toBeLessThanOrEqual(MOVEMENT_PRESETS.smallJump.jumpHeight + 1e-9);
  });

  it('moves the stick man the same on every level whether or not, and whenever, the jump is let go of', () => {
    for (const level of levels) {
      const withoutLetGo = createTunedSim(MOVEMENT_PRESETS.smallJump, { level: level.id });
      const withLetGo = createTunedSim(MOVEMENT_PRESETS.smallJump, { level: level.id });
      for (let tick = 0; tick < 1500; tick += 1) {
        const commands = getMixedCommandsAt(tick);
        withoutLetGo.step(commands.filter((command) => command.type !== 'player/letGoOfJump'));
        withLetGo.step(commands);
        const one = getStickMan(withoutLetGo);
        const other = getStickMan(withLetGo);
        expect(
          [other.feet, other.verticalSpeed, other.horizontalSpeed, other.action],
          `level ${level.id}, tick ${tick}`,
        ).toEqual([one.feet, one.verticalSpeed, one.horizontalSpeed, one.action]);
      }
    }
  });

  it('keeps the speed the stick man walked off an edge with while no key is held', () => {
    const sim = walkOffStart(createTunedSim(MOVEMENT_PRESETS.smallJump));
    sim.step([STOP]);
    stepFor(sim, 10);
    expect(getStickMan(sim).horizontalSpeed).toBe(-MOVEMENT_PRESETS.smallJump.walkSpeed);
  });
});

describe('the nineties platformer preset', () => {
  it("jumps about twice the stick man's height when the jump is held, rising fast and falling faster", () => {
    const small = createTunedSim(MOVEMENT_PRESETS.smallJump);
    const nineties = createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer);
    const smallJump = recordJumpOf(small, { letGoAfter: null });
    const ninetiesJump = recordJumpOf(nineties, { letGoAfter: null });
    expect(ninetiesJump.highest).toBeGreaterThan(
      MOVEMENT_PRESETS.ninetiesPlatformer.jumpHeight * 0.97,
    );
    expect(ninetiesJump.highest).toBeLessThanOrEqual(
      MOVEMENT_PRESETS.ninetiesPlatformer.jumpHeight + 1e-9,
    );
    // Five times as high in about a third of a second: on average more than three times as fast up as the small jump.
    expect(ninetiesJump.ticksToTop * nineties.dt).toBeLessThan(0.4);
    expect(ninetiesJump.highest / ninetiesJump.ticksToTop).toBeGreaterThan(
      (3 * smallJump.highest) / smallJump.ticksToTop,
    );
    // And falls faster than it rose.
    expect(ninetiesJump.ticksDown).toBeLessThan(ninetiesJump.ticksToTop);
  });

  it('jumps as high as the jump is held: the longer, the higher, and a tap is a short hop', () => {
    const heights = [0, 3, 6, 10, 15, null].map((letGoAfter) =>
      measureHighestJump(createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer), { letGoAfter }),
    );
    for (let index = 1; index < heights.length; index += 1) {
      expect(heights[index]).toBeGreaterThan(heights[index - 1]!);
    }
    expect(heights[0]).toBeLessThan(0.5);
    expect(heights[0]).toBeGreaterThan(0);
  });

  it('cuts every jump, not only the first', () => {
    const sim = createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer);
    const first = measureHighestJump(sim, { letGoAfter: 3 });
    const second = measureHighestJump(sim, { letGoAfter: 3 });
    expect(second).toBe(first);
    expect(second).toBeLessThan(MOVEMENT_PRESETS.ninetiesPlatformer.jumpHeight / 2);
  });

  it("stops the stick man's rise when the jump is let go of, then falls", () => {
    const sim = createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer);
    sim.step([JUMP]);
    stepFor(sim, 4);
    sim.step([LET_GO]);
    expect(getStickMan(sim).verticalSpeed).toBeGreaterThan(0);
  });

  it('cuts a jump once: holding it again does not make it rise again', () => {
    const sim = createTunedSim({ ...MOVEMENT_PRESETS.ninetiesPlatformer, letGoCut: 0.5 });
    sim.step([JUMP]);
    sim.step([LET_GO]);
    const afterCut = getStickMan(sim).verticalSpeed;
    // A press in the air is no jump and holds the key again; letting go once more must not cut a second time.
    sim.step([JUMP]);
    sim.step([LET_GO]);
    expect(getStickMan(sim).verticalSpeed).toBeCloseTo(
      afterCut + 2 * MOVEMENT_PRESETS.ninetiesPlatformer.riseGravity * sim.dt,
      9,
    );
  });

  it('stops the stick man at once in the air when no key is held, even falling off an edge', () => {
    const nineties = walkOffStart(createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer));
    nineties.step([STOP]);
    expect(getStickMan(nineties).horizontalSpeed).toBe(0);
    // Away from the floor's end, which would stop the stick man: a held key is walking speed at once.
    nineties.step([WALK_LEFT]);
    expect(getStickMan(nineties).horizontalSpeed).toBe(
      -MOVEMENT_PRESETS.ninetiesPlatformer.walkSpeed,
    );
  });

  it('falls no faster than its fastest fall, in speed and in how far the stick man goes in a tick', () => {
    const sim = walkOffStart(createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer));
    const { fastestFall } = MOVEMENT_PRESETS.ninetiesPlatformer;
    let fastest = 0;
    let fellAtFastest: number | undefined;
    for (let tick = 0; tick < 120 && getStickMan(sim).action === 'jumping'; tick += 1) {
      const before = getStickMan(sim);
      sim.step();
      const after = getStickMan(sim);
      fastest = Math.max(fastest, after.verticalSpeed);
      if (before.verticalSpeed === fastestFall && after.action === 'jumping') {
        fellAtFastest = after.feet.y - before.feet.y;
      }
    }
    expect(fastest).toBe(fastestFall);
    expect(fellAtFastest).toBeCloseTo(fastestFall * sim.dt, 9);
  });
});

describe('tuning the movement', () => {
  it('changes the numbers given and keeps the rest', () => {
    const sim = createSim({ level: 1 });
    sim.step([{ type: 'player/tuneMovement', tuning: { jumpHeight: 3, letGoCut: 0.5 } }]);
    expect(getMovementTuning(sim)).toEqual({
      ...MOVEMENT_PRESETS.current,
      jumpHeight: 3,
      letGoCut: 0.5,
    });
  });

  it('ignores what is not a number within its limits, or not tuning at all, without throwing', () => {
    const sim = createSim({ level: 1 });
    const malformed: unknown[] = [
      { type: 'player/tuneMovement' },
      { type: 'player/tuneMovement', tuning: null },
      { type: 'player/tuneMovement', tuning: [1, 2] },
      { type: 'player/tuneMovement', tuning: 'high' },
      {
        type: 'player/tuneMovement',
        tuning: {
          jumpHeight: NaN,
          walkSpeed: Infinity,
          riseGravity: -5,
          fallGravity: '30',
          letGoCut: 2,
          airSteering: null,
        },
      },
      { type: 'player/tuneMovement', tuning: { gravity: 1, __proto__: { jumpHeight: 3 } } },
    ];
    stepFor(sim, 1, malformed as Command[]);
    expect(getMovementTuning(sim)).toEqual(MOVEMENT_PRESETS.current);
    sim.step([
      {
        type: 'player/tuneMovement',
        tuning: { jumpHeight: 3, walkSpeed: -1 },
      } as unknown as Command,
    ]);
    expect(getMovementTuning(sim)).toEqual({ ...MOVEMENT_PRESETS.current, jumpHeight: 3 });
  });

  it('is kept when the level starts again, a death included, and on the next level', () => {
    const sim = createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer) as Sim;
    sim.startLevel(1);
    expect(getMovementTuning(sim)).toEqual(MOVEMENT_PRESETS.ninetiesPlatformer);
    sim.startLevel(2);
    expect(getMovementTuning(sim)).toEqual(MOVEMENT_PRESETS.ninetiesPlatformer);
  });

  it('goes back to the current preset when the game starts over', () => {
    const sim = createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer) as Sim;
    sim.startOver();
    expect(getMovementTuning(sim)).toEqual(MOVEMENT_PRESETS.current);
  });

  it('is in the snapshot: a restored sim goes on with it, exactly as the one it was taken from', () => {
    const sim = createTunedSim(MOVEMENT_PRESETS.ninetiesPlatformer);
    sim.step([JUMP, WALK_RIGHT]);
    const restored = restoreSim(sim.takeSnapshot());
    const commands = [[LET_GO], [], [STOP], [JUMP], [LET_GO]];
    for (const tick of commands) {
      sim.step(tick);
      restored.step(tick);
    }
    stepFor(sim, 60);
    stepFor(restored, 60);
    expect(getMovementTuning(restored)).toEqual(MOVEMENT_PRESETS.ninetiesPlatformer);
    expect(hashSnapshot(restored.takeSnapshot())).toBe(hashSnapshot(sim.takeSnapshot()));
  });
});

// ---- Helpers ----

const LEVEL = getLevelById(1);
const JUMP: Command = { type: 'player/jump' };
const LET_GO: Command = { type: 'player/letGoOfJump' };
const WALK_LEFT: Command = { type: 'player/walk', direction: -1 };
const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };
const STOP: Command = { type: 'player/walk', direction: 0 };

/**
 * A mix of what a player does, the same on any tick for any level: walking both ways and stopping, jumps (some asked
 * for in the air, so that they wait for the floor), and jumps let go of on the tick they are asked for, a few ticks into
 * the rise, or later. J and K now and then, so that the airplane levels do something too.
 */
function getMixedCommandsAt(tick: number): Command[] {
  const commands: Command[] = [];
  if (tick % 97 === 0) {
    commands.push(tick % 194 === 0 ? WALK_RIGHT : WALK_LEFT);
  }
  if (tick % 61 === 30) {
    commands.push(STOP);
  }
  if (tick % 23 === 0) {
    commands.push(JUMP);
  }
  if (tick % 23 === 0 && tick % 3 === 0) {
    commands.push(LET_GO);
  }
  if (tick % 23 === 4 || tick % 23 === 11) {
    commands.push(LET_GO);
  }
  if (tick % 37 === 5) {
    commands.push({ type: 'world/interact' });
  }
  if (tick % 53 === 7) {
    commands.push({ type: 'item/use' });
  }
  return commands;
}

function createTunedSim(
  tuning: MovementTuning,
  options: { level: number } = { level: 1 },
): SimHandle {
  const sim = createSim({ level: options.level });
  sim.step([{ type: 'player/tuneMovement', tuning }]);
  return sim;
}

function stepFor(sim: SimHandle, ticks: number, commands: readonly Command[] = []): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    sim.step(commands);
  }
}

/** How high the stick man's feet get in one jump from where the stick man stands, letting go of it `letGoAfter` ticks after it was asked for (null: never). */
function measureHighestJump(sim: SimHandle, options: { letGoAfter: number | null }): number {
  return recordJumpOf(sim, { letGoAfter: options.letGoAfter }).highest;
}

/** One jump from where the stick man stands: how high the stick man's feet get, how many ticks to the top and how many from there to the floor. */
function recordJumpOf(
  sim: SimHandle,
  options: { letGoAfter: number | null },
): { highest: number; ticksToTop: number; ticksDown: number } {
  const floor = getStickMan(sim).feet.y;
  sim.step(options.letGoAfter === 0 ? [JUMP, LET_GO] : [JUMP]);
  let highest = 0;
  let ticksToTop = 0;
  let ticks = 1;
  while (getStickMan(sim).action === 'jumping' && ticks < 600) {
    const height = floor - getStickMan(sim).feet.y;
    if (height > highest) {
      highest = height;
      ticksToTop = ticks;
    }
    sim.step(ticks === options.letGoAfter ? [LET_GO] : []);
    ticks += 1;
  }
  expect(getStickMan(sim).action).toBe('standing');
  return { highest, ticksToTop, ticksDown: ticks - ticksToTop };
}

/** The stick man has just walked left off the start of the floor, at walk speed. */
function walkOffStart(sim: SimHandle): SimHandle {
  sim.step([WALK_LEFT]);
  for (let tick = 0; tick < 600 && getPlayerIn(sim).isOnFloor; tick += 1) {
    sim.step();
  }
  expect(getPlayerIn(sim)).toMatchObject({ isOnFloor: false, ticksSinceWalkedOff: 0 });
  expect(getStickMan(sim).feet.x).toBeLessThan(LEVEL.floor[0]!.start.x);
  return sim;
}

function getPlayerIn(sim: SimHandle): PlayerState {
  return sim.takeSnapshot().slices.player as PlayerState;
}
