import { describe, expect, it } from 'vitest';
import { levelById } from '../../content/levels';
import type { Command } from '../../core/commands';
import { createSim, restoreSim } from '../../core/create';
import type { Sim, SimHandle } from '../../core/sim';
import { hashSnapshot } from '../../core/snapshot';
import { MOVEMENT_PRESETS, MOVEMENT_TUNING_LIMITS, PLAYER, type MovementTuning } from './defs';
import type { PlayerState } from './state';
import { movementTuningOf, stickManOf } from './view';

describe('the movement a game nobody tunes plays', () => {
  it('is the current preset, which is PLAYER as it is', () => {
    expect(movementTuningOf(createSim({ level: 1 }))).toEqual(MOVEMENT_PRESETS.current);
    expect(MOVEMENT_PRESETS.current).toMatchObject({
      walkSpeed: PLAYER.walkSpeed,
      jumpHeight: PLAYER.jumpHeight,
      jumpHeightCarrying: PLAYER.jumpHeightCarrying,
      riseGravity: PLAYER.gravity,
      fallGravity: PLAYER.gravity,
      letGoCut: 0,
      airSteering: PLAYER.airSteering,
      airBraking: 0,
    });
  });

  it('jumps as high whether or not the jump is let go of', () => {
    const held = createSim({ level: 1 });
    const letGo = createSim({ level: 1 });
    expect(highestJump(held, { letGoAfter: null })).toBe(highestJump(letGo, { letGoAfter: 0 }));
  });

  it('presets and limits agree: every preset is within the limits', () => {
    for (const preset of Object.values(MOVEMENT_PRESETS)) {
      for (const [name, value] of Object.entries(preset)) {
        const { least, most } = MOVEMENT_TUNING_LIMITS[name as keyof MovementTuning];
        expect(value, name).toBeGreaterThanOrEqual(least);
        expect(value, name).toBeLessThanOrEqual(most);
      }
    }
  });
});

describe('the nineties platformer preset', () => {
  it('jumps about twice his height when the jump is held, rising fast and falling faster', () => {
    const current = createSim({ level: 1 });
    const nineties = tunedSim(MOVEMENT_PRESETS.ninetiesPlatformer);
    const currentJump = jumpOf(current, { letGoAfter: null });
    const ninetiesJump = jumpOf(nineties, { letGoAfter: null });
    expect(ninetiesJump.highest).toBeGreaterThan(MOVEMENT_PRESETS.ninetiesPlatformer.jumpHeight * 0.97);
    expect(ninetiesJump.highest).toBeLessThanOrEqual(MOVEMENT_PRESETS.ninetiesPlatformer.jumpHeight + 1e-9);
    // Five times as high in about a third of a second: on average more than three times as fast up as the current jump.
    expect(ninetiesJump.ticksToTop * nineties.dt).toBeLessThan(0.4);
    expect(ninetiesJump.highest / ninetiesJump.ticksToTop).toBeGreaterThan((3 * currentJump.highest) / currentJump.ticksToTop);
    // And falls faster than it rose.
    expect(ninetiesJump.ticksDown).toBeLessThan(ninetiesJump.ticksToTop);
  });

  it('jumps as high as the jump is held: the longer, the higher, and a tap is a short hop', () => {
    const heights = [0, 3, 6, 10, 15, null].map((letGoAfter) => highestJump(tunedSim(MOVEMENT_PRESETS.ninetiesPlatformer), { letGoAfter }));
    for (let index = 1; index < heights.length; index += 1) expect(heights[index]).toBeGreaterThan(heights[index - 1]!);
    expect(heights[0]).toBeLessThan(0.5);
    expect(heights[0]).toBeGreaterThan(0);
  });

  it('stops his rise when the jump is let go of, then falls', () => {
    const sim = tunedSim(MOVEMENT_PRESETS.ninetiesPlatformer);
    sim.step([JUMP]);
    stepFor(sim, 4);
    sim.step([LET_GO]);
    expect(stickManOf(sim).verticalSpeed).toBeGreaterThan(0);
  });

  it('cuts a jump once: holding it again does not make it rise again', () => {
    const sim = tunedSim({ ...MOVEMENT_PRESETS.ninetiesPlatformer, letGoCut: 0.5 });
    sim.step([JUMP]);
    sim.step([LET_GO]);
    const afterCut = stickManOf(sim).verticalSpeed;
    // A press in the air is no jump and holds the key again; letting go once more must not cut a second time.
    sim.step([JUMP]);
    sim.step([LET_GO]);
    expect(stickManOf(sim).verticalSpeed).toBeCloseTo(afterCut + 2 * MOVEMENT_PRESETS.ninetiesPlatformer.riseGravity * sim.dt, 9);
  });

  it('stops him at once in the air when no key is held, even falling off an edge', () => {
    const current = walkedOffTheStart(createSim({ level: 1 }));
    const nineties = walkedOffTheStart(tunedSim(MOVEMENT_PRESETS.ninetiesPlatformer));
    current.step([STOP]);
    nineties.step([STOP]);
    expect(stickManOf(current).horizontalSpeed).toBe(-PLAYER.walkSpeed);
    expect(stickManOf(nineties).horizontalSpeed).toBe(0);
    // Away from the floor's end, which would stop him: a held key is walking speed at once.
    nineties.step([WALK_LEFT]);
    expect(stickManOf(nineties).horizontalSpeed).toBe(-MOVEMENT_PRESETS.ninetiesPlatformer.walkSpeed);
  });

  it('falls no faster than its fastest fall', () => {
    const sim = walkedOffTheStart(tunedSim(MOVEMENT_PRESETS.ninetiesPlatformer));
    let fastest = 0;
    for (let tick = 0; tick < 120 && sim.level === 1 && stickManOf(sim).action === 'jumping'; tick += 1) {
      sim.step();
      fastest = Math.max(fastest, stickManOf(sim).verticalSpeed);
    }
    expect(fastest).toBe(MOVEMENT_PRESETS.ninetiesPlatformer.mostFallSpeed);
  });
});

describe('tuning the movement', () => {
  it('changes the numbers given and keeps the rest', () => {
    const sim = createSim({ level: 1 });
    sim.step([{ type: 'player/tuneMovement', tuning: { jumpHeight: 2, letGoCut: 0.5 } }]);
    expect(movementTuningOf(sim)).toEqual({ ...MOVEMENT_PRESETS.current, jumpHeight: 2, letGoCut: 0.5 });
  });

  it('ignores what is not a number within its limits, or not tuning at all, without throwing', () => {
    const sim = createSim({ level: 1 });
    const malformed: unknown[] = [
      { type: 'player/tuneMovement' },
      { type: 'player/tuneMovement', tuning: null },
      { type: 'player/tuneMovement', tuning: [1, 2] },
      { type: 'player/tuneMovement', tuning: 'high' },
      { type: 'player/tuneMovement', tuning: { jumpHeight: NaN, walkSpeed: Infinity, riseGravity: -5, fallGravity: '30', letGoCut: 2, airSteering: null } },
      { type: 'player/tuneMovement', tuning: { gravity: 1, __proto__: { jumpHeight: 3 } } },
    ];
    stepFor(sim, 1, malformed as Command[]);
    expect(movementTuningOf(sim)).toEqual(MOVEMENT_PRESETS.current);
    sim.step([{ type: 'player/tuneMovement', tuning: { jumpHeight: 3, walkSpeed: -1 } } as unknown as Command]);
    expect(movementTuningOf(sim)).toEqual({ ...MOVEMENT_PRESETS.current, jumpHeight: 3 });
  });

  it('is kept when the level starts again, a death included, and on the next level', () => {
    const sim = tunedSim(MOVEMENT_PRESETS.ninetiesPlatformer) as Sim;
    sim.startLevel(1);
    expect(movementTuningOf(sim)).toEqual(MOVEMENT_PRESETS.ninetiesPlatformer);
    sim.startLevel(2);
    expect(movementTuningOf(sim)).toEqual(MOVEMENT_PRESETS.ninetiesPlatformer);
  });

  it('goes back to the current preset when the game starts over', () => {
    const sim = tunedSim(MOVEMENT_PRESETS.ninetiesPlatformer) as Sim;
    sim.startOver();
    expect(movementTuningOf(sim)).toEqual(MOVEMENT_PRESETS.current);
  });

  it('is in the snapshot: a restored sim goes on with it, exactly as the one it was taken from', () => {
    const sim = tunedSim(MOVEMENT_PRESETS.ninetiesPlatformer);
    sim.step([JUMP, WALK_RIGHT]);
    const restored = restoreSim(sim.snapshot());
    const commands = [[LET_GO], [], [STOP], [JUMP], [LET_GO]];
    for (const tick of commands) {
      sim.step(tick);
      restored.step(tick);
    }
    stepFor(sim, 60);
    stepFor(restored, 60);
    expect(movementTuningOf(restored)).toEqual(MOVEMENT_PRESETS.ninetiesPlatformer);
    expect(hashSnapshot(restored.snapshot())).toBe(hashSnapshot(sim.snapshot()));
  });
});

// ---- Helpers ----

const LEVEL = levelById(1);
const JUMP: Command = { type: 'player/jump' };
const LET_GO: Command = { type: 'player/letGoOfJump' };
const WALK_LEFT: Command = { type: 'player/walk', direction: -1 };
const WALK_RIGHT: Command = { type: 'player/walk', direction: 1 };
const STOP: Command = { type: 'player/walk', direction: 0 };

function tunedSim(tuning: MovementTuning): SimHandle {
  const sim = createSim({ level: 1 });
  sim.step([{ type: 'player/tuneMovement', tuning }]);
  return sim;
}

function stepFor(sim: SimHandle, ticks: number, commands: readonly Command[] = []): void {
  for (let tick = 0; tick < ticks; tick += 1) sim.step(commands);
}

/** How high his feet get in one jump from where he stands, letting go of it `letGoAfter` ticks after it was asked for (null: never). */
function highestJump(sim: SimHandle, { letGoAfter }: { letGoAfter: number | null }): number {
  return jumpOf(sim, { letGoAfter }).highest;
}

/** One jump from where he stands: how high his feet get, how many ticks to the top and how many from there to the floor. */
function jumpOf(sim: SimHandle, { letGoAfter }: { letGoAfter: number | null }): { highest: number; ticksToTop: number; ticksDown: number } {
  const floor = stickManOf(sim).feet.y;
  sim.step(letGoAfter === 0 ? [JUMP, LET_GO] : [JUMP]);
  let highest = 0;
  let ticksToTop = 0;
  let ticks = 1;
  while (stickManOf(sim).action === 'jumping' && ticks < 600) {
    const height = floor - stickManOf(sim).feet.y;
    if (height > highest) {
      highest = height;
      ticksToTop = ticks;
    }
    sim.step(ticks === letGoAfter ? [LET_GO] : []);
    ticks += 1;
  }
  expect(stickManOf(sim).action).toBe('standing');
  return { highest, ticksToTop, ticksDown: ticks - ticksToTop };
}

/** He has just walked left off the start of the floor, at walk speed. */
function walkedOffTheStart(sim: SimHandle): SimHandle {
  sim.step([WALK_LEFT]);
  for (let tick = 0; tick < 600 && playerIn(sim).onFloor; tick += 1) sim.step();
  expect(playerIn(sim)).toMatchObject({ onFloor: false, ticksSinceWalkedOff: 0 });
  expect(stickManOf(sim).feet.x).toBeLessThan(LEVEL.floor[0]!.from.x);
  return sim;
}

function playerIn(sim: SimHandle): PlayerState {
  return sim.snapshot().slices.player as PlayerState;
}
