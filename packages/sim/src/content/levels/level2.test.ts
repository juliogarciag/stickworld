import { describe, expect, it } from 'vitest';
import type { Command } from '../../core/commands';
import { createSim } from '../../core/create';
import { Sim, type SimHandle } from '../../core/sim';
import { features } from '../../features';
import { LEVEL_END } from '../../features/flag/defs';
import { flagOf } from '../../features/flag/view';
import { isItemDefId, PAPER_ITEM_ID } from '../../features/inventory/defs';
import { itemSlotsOf } from '../../features/inventory/view';
import { PLAYER } from '../../features/player/defs';
import { stickManOf } from '../../features/player/view';
import { levels } from '.';
import { level2 } from './level2';

describe('level 2', () => {
  it('is finished by jumping the gap and walking to the flag, which gives the paper', () => {
    const sim = createSim({ level: 2 });
    const { overTheGap } = play(sim, JUMP_THE_GAP);
    expect(overTheGap.length).toBeGreaterThan(0);
    for (const feet of overTheGap) expect(feet.y).toBeLessThan(FLOOR_Y);
    expect(sim.level).toBe(2);
    expect(flagOf(sim)!.reached).toBe(true);
    expect(stickManOf(sim).action).toBe('cheering');
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: false }]);
  });

  it('holds no paper until the flag is reached', () => {
    const sim = createSim({ level: 2 });
    play(sim, { ...JUMP_THE_GAP, ticks: TICK_PAST_THE_GAP });
    expect(stickManOf(sim).feet.x).toBeGreaterThan(GAP.to);
    expect(flagOf(sim)!.reached).toBe(false);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
  });

  it('cannot be finished by walking: he falls into the gap, dies, and the level starts again', () => {
    const sim = createSim({ level: 2 });
    const { overTheGap, deepest, restartedAtTick } = play(sim, WALK_INTO_THE_GAP);
    expect(overTheGap.some((feet) => feet.y > FLOOR_Y)).toBe(true);
    expect(deepest).toBeGreaterThan(FLOOR_Y + PLAYER.fallBelowFloor - 1);
    expect(restartedAtTick).not.toBeNull();
    expect(sim.level).toBe(2);
    expect(sim.tick).toBe(WALK_INTO_THE_GAP.ticks);
    expect(stickManOf(sim)).toMatchObject({ feet: level2.start, action: 'standing', verticalSpeed: 0 });
    expect(flagOf(sim)!.reached).toBe(false);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
  });

  it('cannot be finished by jumping too early: he lands before the gap and walks into it', () => {
    const sim = createSim({ level: 2 });
    const { restartedAtTick } = play(sim, { commands: [WALK_RIGHT_AT_0, { atTick: 30, command: { type: 'player/jump' } }], ticks: 400 });
    expect(restartedAtTick).not.toBeNull();
    expect(flagOf(sim)!.reached).toBe(false);
  });

  it('has a gap wider than a walk can cross and narrower than a jump', () => {
    const jumpSeconds = 2 * Math.sqrt((2 * PLAYER.jumpHeight) / PLAYER.gravity);
    expect(GAP.to - GAP.from).toBeGreaterThan(0.25 * PLAYER.walkSpeed * jumpSeconds);
    expect(GAP.to - GAP.from).toBeLessThan(0.8 * PLAYER.walkSpeed * jumpSeconds);
  });

  it('can be played again after a death: the same jump then reaches the flag', () => {
    const sim = createSim({ level: 2 });
    const { restartedAtTick } = play(sim, WALK_INTO_THE_GAP);
    play(sim, { commands: [{ atTick: 0, command: { type: 'player/walk', direction: 0 } }], ticks: 1 });
    play(sim, JUMP_THE_GAP);
    expect(restartedAtTick).not.toBeNull();
    expect(flagOf(sim)!.reached).toBe(true);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });
});

describe('the paper', () => {
  it('comes from playing levels 1 and 2 in a row, with nothing in the slot until level 2 is finished', () => {
    const sim = createSim({ level: 1 });
    play(sim, { commands: [WALK_RIGHT_AT_0], ticks: 600 });
    play(sim, { commands: [], ticks: Math.ceil(LEVEL_END.pauseBeforeNextLevel / sim.dt) });
    expect(sim.level).toBe(2);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
    play(sim, { commands: [{ atTick: 0, command: { type: 'player/walk', direction: 0 } }], ticks: 1 });
    play(sim, JUMP_THE_GAP);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
  });

  it('is still held, and still selected, after a death in a level played later', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 2 } });
    play(sim, JUMP_THE_GAP);
    sim.step([{ type: 'inventory/select', slot: 1 }]);
    const held = itemSlotsOf(sim);
    expect(held).toEqual([{ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true }]);

    // Level 3 does not exist yet: any level with an edge to fall from stands in for it.
    sim.startLevel(1);
    expect(itemSlotsOf(sim)).toEqual(held);
    const { deepest, restartedAtTick } = play(sim, { commands: [{ atTick: 0, command: { type: 'player/walk', direction: -1 } }], ticks: 400 });
    expect(deepest).toBeGreaterThan(PLAYER.fallBelowFloor - 1);
    expect(restartedAtTick).not.toBeNull();
    expect(sim.level).toBe(1);
    expect(itemSlotsOf(sim)).toEqual(held);
  });
});

describe('every level', () => {
  it.each(levels.map((level) => [level.id, level] as const))('level %i gives at its flag nothing, or an item, and then has a flag', (_, level) => {
    if (level.flagGivesItem === undefined) return;
    expect(isItemDefId(level.flagGivesItem)).toBe(true);
    expect(flagOf(createSim({ level: level.id }))).toBeDefined();
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

/** The tick on which he is a quarter of a metre before the edge of the gap, walking right from the start. */
const TICK_NEAR_THE_EDGE = Math.round((GAP.from - 0.25 - level2.start.x) / (PLAYER.walkSpeed / 60));
const TICK_PAST_THE_GAP = TICK_NEAR_THE_EDGE + 60;

/** Walk right, jump just before the edge, keep walking to the flag. */
const JUMP_THE_GAP: Recording = {
  commands: [WALK_RIGHT_AT_0, { atTick: TICK_NEAR_THE_EDGE, command: { type: 'player/jump' } }],
  ticks: 400,
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
  let previousX = stickManOf(sim).feet.x;
  for (let tick = 0; tick < ticks; tick += 1) {
    sim.step(commands.filter(({ atTick }) => atTick === tick).map(({ command }) => command));
    const { feet } = stickManOf(sim);
    if (sim.level === 2 && feet.x > GAP.from && feet.x < GAP.to) overTheGap.push(feet);
    deepest = Math.max(deepest, feet.y);
    // He only ever goes back to where a level starts, without walking there, when the level starts again.
    if (Math.abs(feet.x - previousX) > 1) restartedAtTick = tick;
    previousX = feet.x;
  }
  return { overTheGap, deepest, restartedAtTick };
}
