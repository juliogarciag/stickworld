import { describe, expect, it } from 'vitest';
import type { Command } from '../../core/commands';
import { createSim } from '../../core/create';
import { Sim, type SimHandle } from '../../core/sim';
import { features } from '../../features';
import { LEVEL_END } from '../../features/flag/defs';
import { getFlag } from '../../features/flag/view';
import { isItemDefId, PAPER_ITEM_ID } from '../../features/inventory/defs';
import { getItemSlots } from '../../features/inventory/view';
import { PLAYER } from '../../features/player/defs';
import { getStickMan } from '../../features/player/view';
import { STICK_MAN_WIDTH, TICK_RATE } from '../tuning';
import { levels } from '.';
import { level2 } from './level2';

describe('level 2', () => {
  it('is finished by jumping the gap and walking to the flag, which gives the paper', () => {
    const sim = createSim({ level: 2 });
    const { overGap } = play(sim, JUMP_GAP);
    expect(overGap.length).toBeGreaterThan(0);
    for (const feet of overGap) {
      expect(feet.y).toBeLessThan(FLOOR_Y);
    }
    expect(sim.level).toBe(2);
    expect(getFlag(sim)!.isReached).toBe(true);
    expect(getStickMan(sim).action).toBe('cheering');
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: false }]);
  });

  it('holds no paper until the flag is reached', () => {
    const sim = createSim({ level: 2 });
    play(sim, { ...JUMP_GAP, ticks: TICK_PAST_GAP });
    expect(getStickMan(sim).feet.x).toBeGreaterThan(GAP.end);
    expect(getFlag(sim)!.isReached).toBe(false);
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
  });

  it('cannot be finished by walking: the stick man falls into the gap, dies, and the level starts again', () => {
    const sim = createSim({ level: 2 });
    const { overGap, deepest, restartedAtTick } = play(sim, WALK_INTO_GAP);
    expect(overGap.some((feet) => feet.y > FLOOR_Y)).toBe(true);
    expect(deepest).toBeGreaterThan(FLOOR_Y + PLAYER.fallBelowFloor - ONE_TICK_OF_FALL);
    expect(restartedAtTick).not.toBeNull();
    expect(sim.level).toBe(2);
    expect(sim.tick).toBe(WALK_INTO_GAP.ticks);
    expect(getStickMan(sim)).toMatchObject({
      feet: level2.start,
      action: 'standing',
      verticalSpeed: 0,
    });
    expect(getFlag(sim)!.isReached).toBe(false);
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
  });

  it('cannot be finished by steering across the gap in a fall: the far end of the gap stops the stick man and the stick man drops beside it', () => {
    const sim = createSim({ level: 2 });
    const { overGap, restartedAtTick } = play(sim, WALK_INTO_GAP);
    // Stopped beside the far end until the stick man's head has dropped below it; then the held key
    // takes the stick man on under the floor.
    const besideFarEnd = overGap.filter(
      (feet) => Math.abs(feet.x - (GAP.end - STICK_MAN_WIDTH / 2)) < 1e-6,
    );
    expect(besideFarEnd.length).toBeGreaterThan(5);
    expect(Math.min(...besideFarEnd.map((feet) => feet.y))).toBeGreaterThan(FLOOR_Y);
    expect(restartedAtTick).not.toBeNull();
    expect(getFlag(sim)!.isReached).toBe(false);
  });

  it('cannot be finished by letting go of the key at the edge: the stick man stops in the air and drops into the gap', () => {
    const sim = createSim({ level: 2 });
    const { overGap, restartedAtTick } = play(sim, {
      commands: [
        WALK_RIGHT_AT_0,
        { atTick: TICK_PAST_EDGE, command: { type: 'player/walk', direction: 0 } },
      ],
      ticks: 400,
    });
    expect(Math.max(...overGap.map((feet) => feet.x))).toBeLessThan(
      GAP.start + (GAP.end - GAP.start) / 2,
    );
    expect(restartedAtTick).not.toBeNull();
    expect(getFlag(sim)!.isReached).toBe(false);
  });

  it('cannot be finished by jumping too early: the stick man lands before the gap and walks into it', () => {
    const sim = createSim({ level: 2 });
    const { restartedAtTick } = play(sim, {
      commands: [WALK_RIGHT_AT_0, { atTick: 30, command: { type: 'player/jump' } }],
      ticks: 400,
    });
    expect(restartedAtTick).not.toBeNull();
    expect(getFlag(sim)!.isReached).toBe(false);
  });

  it('has a gap a jump clears with room to spare: the stick man need not take off at the very edge', () => {
    const jumpSeconds =
      Math.sqrt((2 * PLAYER.jumpHeight) / PLAYER.riseGravity) +
      Math.sqrt((2 * PLAYER.jumpHeight) / PLAYER.fallGravity);
    const jumpLength = PLAYER.walkSpeed * jumpSeconds;
    expect(GAP.end - GAP.start).toBeLessThan(LARGEST_SHARE_OF_JUMP * jumpLength);
  });

  it('can be played again after a death: the same jump then reaches the flag', () => {
    const sim = createSim({ level: 2 });
    const { restartedAtTick } = play(sim, WALK_INTO_GAP);
    expect(restartedAtTick).not.toBeNull();
    // The death left the stick man standing at the start, so the recording plays as it does on a
    // fresh level.
    expect(getStickMan(sim)).toMatchObject({ feet: level2.start, action: 'standing' });
    play(sim, JUMP_GAP);
    expect(getFlag(sim)!.isReached).toBe(true);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });
});

describe('the paper', () => {
  it('comes from playing levels 1 and 2 in a row, with nothing in the slot until level 2 is finished', () => {
    const sim = createSim({ level: 1 });
    sim.step([WALK_RIGHT_AT_0.command]);
    for (let tick = 0; tick < 600 && !getFlag(sim)!.isReached; tick += 1) {
      sim.step();
    }
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    for (
      let tick = 0;
      tick < Math.ceil(LEVEL_END.pauseBeforeNextLevel * TICK_RATE) + 1;
      tick += 1
    ) {
      sim.step();
    }
    expect(sim.level).toBe(2);
    expect(getStickMan(sim)).toMatchObject({ feet: level2.start, action: 'standing' });
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    play(sim, JUMP_GAP);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('is still held, and still selected, after a death in a level played later', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 2 } });
    play(sim, JUMP_GAP);
    sim.step([{ type: 'inventory/select', slot: 1 }]);
    const held = getItemSlots(sim);
    expect(held).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, isSelected: true }]);

    sim.startLevel(3);
    expect(getItemSlots(sim)).toEqual(held);
    const { deepest, restartedAtTick } = play(sim, {
      commands: [{ atTick: 0, command: { type: 'player/walk', direction: -1 } }],
      ticks: 400,
    });
    expect(deepest).toBeGreaterThan(PLAYER.fallBelowFloor - ONE_TICK_OF_FALL);
    expect(restartedAtTick).not.toBeNull();
    expect(sim.level).toBe(3);
    expect(getItemSlots(sim)).toEqual(held);
  });
});

describe('every level', () => {
  it.each(LEVELS_WHOSE_FLAG_GIVES_ITEM.map((level) => [level.id, level] as const))(
    "level %i's flag gives an item that exists, and the level has a flag",
    (_, level) => {
      expect(isItemDefId(level.flagGivesItem!)).toBe(true);
      expect(getFlag(createSim({ level: level.id }))).toBeDefined();
    },
  );
});

// ---- Helpers ----

const FLOOR_Y = 0;
/** The gap: where the first floor segment ends and the second begins. */
const GAP = { start: level2.floor[0]!.end.x, end: level2.floor[1]!.start.x };

/**
 * Commands as a player gave them, each with the tick it arrived on, and how long the recording
 * runs.
 */
interface Recording {
  readonly commands: readonly { readonly atTick: number; readonly command: Command }[];
  readonly ticks: number;
}

const WALK_RIGHT_AT_0 = { atTick: 0, command: { type: 'player/walk', direction: 1 } } as const;

const LEVELS_WHOSE_FLAG_GIVES_ITEM = levels.filter((level) => level.flagGivesItem !== undefined);

/**
 * The gap is at most this share of the length of a jump, so there is a stretch of floor before the
 * edge to take off from.
 */
const LARGEST_SHARE_OF_JUMP = 0.8;

/**
 * The stick man is sent back to the start on the tick the stick man passes the depth that kills, so
 * the deepest the stick man is ever seen is up to one tick of falling short of it. At that depth
 * the stick man has fallen `fallBelowFloor`, which gives the stick man's speed, unless it got to
 * its fastest fall before.
 */
const ONE_TICK_OF_FALL =
  Math.min(Math.sqrt(2 * PLAYER.fallGravity * PLAYER.fallBelowFloor), PLAYER.fastestFall) /
  TICK_RATE;

/**
 * The tick on which the stick man is a quarter of the gap's width before its edge, walking right
 * from the start: where a player would jump.
 */
const TICK_NEAR_EDGE = Math.round(
  ((GAP.start - 0.25 * (GAP.end - GAP.start) - level2.start.x) / PLAYER.walkSpeed) * TICK_RATE,
);
/**
 * The last tick on which the stick man still stands on the first segment, walking right from the
 * start.
 */
const TICK_AT_EDGE = Math.floor(((GAP.start - level2.start.x) / PLAYER.walkSpeed) * TICK_RATE) - 1;
/** A few ticks later the stick man has walked off it and is falling. */
const TICK_PAST_EDGE = TICK_AT_EDGE + 4;
/** A second later the stick man has landed and walked on, well short of the flag. */
const TICK_PAST_GAP = TICK_NEAR_EDGE + TICK_RATE;

/** Walk right, jump just before the edge, keep walking to the flag. */
const JUMP_GAP: Recording = {
  commands: [WALK_RIGHT_AT_0, { atTick: TICK_NEAR_EDGE, command: { type: 'player/jump' } }],
  ticks: 280,
};

/** Walk right and never jump. */
const WALK_INTO_GAP: Recording = { commands: [WALK_RIGHT_AT_0], ticks: 400 };

interface Played {
  /** Where the stick man's feet were on every tick they were over the gap. */
  readonly overGap: { x: number; y: number }[];
  /** The lowest the stick man's feet got (y points down, so the largest y). */
  readonly deepest: number;
  /**
   * The tick on which the stick man was back at the level's start after having left it, or null.
   */
  readonly restartedAtTick: number | null;
}

function play(sim: SimHandle, recording: Recording): Played {
  const overGap: { x: number; y: number }[] = [];
  let deepest = -Infinity;
  let restartedAtTick: number | null = null;
  let previousX = getStickMan(sim).feet.x;
  for (let tick = 0; tick < recording.ticks; tick += 1) {
    sim.step(
      recording.commands.filter((entry) => entry.atTick === tick).map((entry) => entry.command),
    );
    const { feet } = getStickMan(sim);
    if (sim.level === 2 && feet.x > GAP.start && feet.x < GAP.end) {
      overGap.push(feet);
    }
    deepest = Math.max(deepest, feet.y);
    // The stick man only ever goes back to where a level starts, without walking there, when the
    // level starts again.
    if (Math.abs(feet.x - previousX) > 1) {
      restartedAtTick = tick;
    }
    previousX = feet.x;
    // The recording ends at the flag: a little later the next level starts.
    if (sim.level === 2 && getFlag(sim)!.isReached) {
      break;
    }
  }
  return { overGap, deepest, restartedAtTick };
}
