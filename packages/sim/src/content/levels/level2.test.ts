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
    const { overTheGap } = play(sim, JUMP_THE_GAP);
    expect(overTheGap.length).toBeGreaterThan(0);
    for (const feet of overTheGap) expect(feet.y).toBeLessThan(FLOOR_Y);
    expect(sim.level).toBe(2);
    expect(getFlag(sim)!.reached).toBe(true);
    expect(getStickMan(sim).action).toBe('cheering');
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: false }]);
  });

  it('holds no paper until the flag is reached', () => {
    const sim = createSim({ level: 2 });
    play(sim, { ...JUMP_THE_GAP, ticks: TICK_PAST_THE_GAP });
    expect(getStickMan(sim).feet.x).toBeGreaterThan(GAP.to);
    expect(getFlag(sim)!.reached).toBe(false);
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
  });

  it('cannot be finished by walking: he falls into the gap, dies, and the level starts again', () => {
    const sim = createSim({ level: 2 });
    const { overTheGap, deepest, restartedAtTick } = play(sim, WALK_INTO_THE_GAP);
    expect(overTheGap.some((feet) => feet.y > FLOOR_Y)).toBe(true);
    expect(deepest).toBeGreaterThan(FLOOR_Y + PLAYER.fallBelowFloor - ONE_TICK_OF_FALL);
    expect(restartedAtTick).not.toBeNull();
    expect(sim.level).toBe(2);
    expect(sim.tick).toBe(WALK_INTO_THE_GAP.ticks);
    expect(getStickMan(sim)).toMatchObject({ feet: level2.start, action: 'standing', verticalSpeed: 0 });
    expect(getFlag(sim)!.reached).toBe(false);
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
  });

  it('cannot be finished by steering across the gap in a fall: the far end of the gap stops him and he drops beside it', () => {
    const sim = createSim({ level: 2 });
    const { overTheGap, restartedAtTick } = play(sim, WALK_INTO_THE_GAP);
    // Stopped beside the far end until his head has dropped below it; then the held key takes him on under the floor.
    const besideTheFarEnd = overTheGap.filter((feet) => Math.abs(feet.x - (GAP.to - STICK_MAN_WIDTH / 2)) < 1e-6);
    expect(besideTheFarEnd.length).toBeGreaterThan(5);
    expect(Math.min(...besideTheFarEnd.map((feet) => feet.y))).toBeGreaterThan(FLOOR_Y);
    expect(restartedAtTick).not.toBeNull();
    expect(getFlag(sim)!.reached).toBe(false);
  });

  it('cannot be finished by letting go of the key at the edge: he stops in the air and drops into the gap', () => {
    const sim = createSim({ level: 2 });
    const { overTheGap, restartedAtTick } = play(sim, { commands: [WALK_RIGHT_AT_0, { atTick: TICK_PAST_THE_EDGE, command: { type: 'player/walk', direction: 0 } }], ticks: 400 });
    expect(Math.max(...overTheGap.map((feet) => feet.x))).toBeLessThan(GAP.from + (GAP.to - GAP.from) / 2);
    expect(restartedAtTick).not.toBeNull();
    expect(getFlag(sim)!.reached).toBe(false);
  });

  it('cannot be finished by jumping too early: he lands before the gap and walks into it', () => {
    const sim = createSim({ level: 2 });
    const { restartedAtTick } = play(sim, { commands: [WALK_RIGHT_AT_0, { atTick: 30, command: { type: 'player/jump' } }], ticks: 400 });
    expect(restartedAtTick).not.toBeNull();
    expect(getFlag(sim)!.reached).toBe(false);
  });

  it('has a gap a jump clears with room to spare: he need not take off at the very edge', () => {
    const jumpSeconds = Math.sqrt((2 * PLAYER.jumpHeight) / PLAYER.riseGravity) + Math.sqrt((2 * PLAYER.jumpHeight) / PLAYER.fallGravity);
    const jumpLength = PLAYER.walkSpeed * jumpSeconds;
    expect(GAP.to - GAP.from).toBeLessThan(LARGEST_SHARE_OF_A_JUMP * jumpLength);
  });

  it('can be played again after a death: the same jump then reaches the flag', () => {
    const sim = createSim({ level: 2 });
    const { restartedAtTick } = play(sim, WALK_INTO_THE_GAP);
    expect(restartedAtTick).not.toBeNull();
    // The death left him standing at the start, so the recording plays as it does on a fresh level.
    expect(getStickMan(sim)).toMatchObject({ feet: level2.start, action: 'standing' });
    play(sim, JUMP_THE_GAP);
    expect(getFlag(sim)!.reached).toBe(true);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });
});

describe('the paper', () => {
  it('comes from playing levels 1 and 2 in a row, with nothing in the slot until level 2 is finished', () => {
    const sim = createSim({ level: 1 });
    sim.step([WALK_RIGHT_AT_0.command]);
    for (let tick = 0; tick < 600 && !getFlag(sim)!.reached; tick += 1) sim.step();
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    for (let tick = 0; tick < Math.ceil(LEVEL_END.pauseBeforeNextLevel * TICK_RATE) + 1; tick += 1) sim.step();
    expect(sim.level).toBe(2);
    expect(getStickMan(sim)).toMatchObject({ feet: level2.start, action: 'standing' });
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    play(sim, JUMP_THE_GAP);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('is still held, and still selected, after a death in a level played later', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 2 } });
    play(sim, JUMP_THE_GAP);
    sim.step([{ type: 'inventory/select', slot: 1 }]);
    const held = getItemSlots(sim);
    expect(held).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true }]);

    sim.startLevel(3);
    expect(getItemSlots(sim)).toEqual(held);
    const { deepest, restartedAtTick } = play(sim, { commands: [{ atTick: 0, command: { type: 'player/walk', direction: -1 } }], ticks: 400 });
    expect(deepest).toBeGreaterThan(PLAYER.fallBelowFloor - ONE_TICK_OF_FALL);
    expect(restartedAtTick).not.toBeNull();
    expect(sim.level).toBe(3);
    expect(getItemSlots(sim)).toEqual(held);
  });
});

describe('every level', () => {
  it.each(LEVELS_WHOSE_FLAG_GIVES_AN_ITEM.map((level) => [level.id, level] as const))("level %i's flag gives an item that exists, and the level has a flag", (_, level) => {
    expect(isItemDefId(level.flagGivesItem!)).toBe(true);
    expect(getFlag(createSim({ level: level.id }))).toBeDefined();
  });
});

// ---- Helpers ----

const FLOOR_Y = 0;
/** The gap: where the first floor segment ends and the second begins. */
const GAP = { from: level2.floor[0]!.to.x, to: level2.floor[1]!.from.x };

/** Commands as a player gave them, each with the tick it arrived on, and how long the recording runs. */
interface Recording {
  readonly commands: readonly { readonly atTick: number; readonly command: Command }[];
  readonly ticks: number;
}

const WALK_RIGHT_AT_0 = { atTick: 0, command: { type: 'player/walk', direction: 1 } } as const;

const LEVELS_WHOSE_FLAG_GIVES_AN_ITEM = levels.filter((level) => level.flagGivesItem !== undefined);

/** The gap is at most this share of the length of a jump, so there is a stretch of floor before the edge to take off from. */
const LARGEST_SHARE_OF_A_JUMP = 0.8;

/**
 * He is sent back to the start on the tick he passes the depth that kills,
 * so the deepest he is ever seen is up to one tick of falling short of it.
 * At that depth he has fallen `fallBelowFloor`, which gives his speed, unless he got to his fastest fall before.
 */
const ONE_TICK_OF_FALL = Math.min(Math.sqrt(2 * PLAYER.fallGravity * PLAYER.fallBelowFloor), PLAYER.fastestFall) / TICK_RATE;

/** The tick on which he is a quarter of the gap's width before its edge, walking right from the start: where a player would jump. */
const TICK_NEAR_THE_EDGE = Math.round(((GAP.from - 0.25 * (GAP.to - GAP.from) - level2.start.x) / PLAYER.walkSpeed) * TICK_RATE);
/** The last tick on which he still stands on the first segment, walking right from the start. */
const TICK_AT_THE_EDGE = Math.floor(((GAP.from - level2.start.x) / PLAYER.walkSpeed) * TICK_RATE) - 1;
/** A few ticks later he has walked off it and is falling. */
const TICK_PAST_THE_EDGE = TICK_AT_THE_EDGE + 4;
/** A second later he has landed and walked on, well short of the flag. */
const TICK_PAST_THE_GAP = TICK_NEAR_THE_EDGE + TICK_RATE;

/** Walk right, jump just before the edge, keep walking to the flag. */
const JUMP_THE_GAP: Recording = {
  commands: [WALK_RIGHT_AT_0, { atTick: TICK_NEAR_THE_EDGE, command: { type: 'player/jump' } }],
  ticks: 280,
};

/** Walk right and never jump. */
const WALK_INTO_THE_GAP: Recording = { commands: [WALK_RIGHT_AT_0], ticks: 400 };

interface Played {
  /** Where his feet were on every tick they were over the gap. */
  readonly overTheGap: { x: number; y: number }[];
  /** The lowest his feet got (y points down, so the largest y). */
  readonly deepest: number;
  /** The tick on which he was back at the level's start after having left it, or null. */
  readonly restartedAtTick: number | null;
}

function play(sim: SimHandle, { commands, ticks }: Recording): Played {
  const overTheGap: { x: number; y: number }[] = [];
  let deepest = -Infinity;
  let restartedAtTick: number | null = null;
  let previousX = getStickMan(sim).feet.x;
  for (let tick = 0; tick < ticks; tick += 1) {
    sim.step(commands.filter(({ atTick }) => atTick === tick).map(({ command }) => command));
    const { feet } = getStickMan(sim);
    if (sim.level === 2 && feet.x > GAP.from && feet.x < GAP.to) overTheGap.push(feet);
    deepest = Math.max(deepest, feet.y);
    // He only ever goes back to where a level starts, without walking there, when the level starts again.
    if (Math.abs(feet.x - previousX) > 1) restartedAtTick = tick;
    previousX = feet.x;
    // The recording ends at the flag: a little later the next level starts.
    if (sim.level === 2 && getFlag(sim)!.reached) break;
  }
  return { overTheGap, deepest, restartedAtTick };
}
