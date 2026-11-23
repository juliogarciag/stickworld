import { describe, expect, it } from 'vitest';
import type { Command } from '../../core/commands';
import { createSim } from '../../core/create';
import type { SimHandle } from '../../core/sim';
import { AIRPLANE } from '../../features/airplane/defs';
import { airplaneOf } from '../../features/airplane/view';
import { recipeListOf } from '../../features/crafting/view';
import { FLAG_DEF_ID, LEVEL_END } from '../../features/flag/defs';
import { flagOf } from '../../features/flag/view';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from '../../features/inventory/defs';
import { itemSlotsOf } from '../../features/inventory/view';
import { itemUseOf } from '../../features/item/view';
import { letterOf } from '../../features/letter/view';
import { PLAYER } from '../../features/player/defs';
import { stickManOf } from '../../features/player/view';
import { interactionOf } from '../../features/world/view';
import { STICK_MAN_HEIGHT, TICK_RATE } from '../tuning';
import { level2 } from './level2';
import { level3 } from './level3';

describe('level 3', () => {
  it('has a gap several jumps long, with the flag on the far side and the letter just in front of the start', () => {
    const longestJump = PLAYER.walkSpeed * (2 * Math.sqrt((2 * PLAYER.jumpHeight) / PLAYER.gravity) + PLAYER.jumpAskedLateWindow);
    expect(GAP.to - GAP.from).toBeGreaterThan(5 * longestJump);
    expect(level3.placements.find((placement) => placement.defId === FLAG_DEF_ID)!.at.x).toBeGreaterThan(GAP.to);
    expect(LETTER_AT.x).toBeGreaterThan(level3.start.x);
    expect(LETTER_AT.x - level3.start.x).toBeLessThan(STICK_MAN_HEIGHT);
  });

  it('cannot be finished by jumping, whenever he takes off: he never stands past the gap, and the level starts again', () => {
    for (let jumpAtTick = TICK_AT_THE_EDGE - 40; jumpAtTick <= TICK_AT_THE_EDGE + 12; jumpAtTick += 1) {
      const sim = createSim({ level: 3 });
      const { furthestStoodAt, restarted } = playToTheEnd(sim, [WALK_RIGHT_AT_0, { atTick: jumpAtTick, command: { type: 'player/jump' } }]);
      expect(furthestStoodAt, `jumping at tick ${jumpAtTick}`).toBeLessThanOrEqual(GAP.from);
      expect(restarted, `jumping at tick ${jumpAtTick}`).toBe(true);
      expect(flagOf(sim)!.reached).toBe(false);
    }
  });

  it('cannot be finished by jumping again and again all the way to the edge and past it', () => {
    const sim = createSim({ level: 3 });
    const everyTick = Array.from({ length: 400 }, (_, atTick) => ({ atTick, command: { type: 'player/jump' } as Command }));
    const { furthestStoodAt, restarted } = playToTheEnd(sim, [WALK_RIGHT_AT_0, ...everyTick]);
    expect(furthestStoodAt).toBeLessThanOrEqual(GAP.from);
    expect(restarted).toBe(true);
  });

  it('cannot be finished by jumping with the airplane over his head either: that jump is no longer than the other', () => {
    for (let jumpAtTick = TICK_AT_THE_EDGE - 40; jumpAtTick <= TICK_AT_THE_EDGE + 12; jumpAtTick += 1) {
      const sim = createSim({ level: 3 });
      // Read, put away, select, open, fold, set down, lift: the letter gives the paper to a level 3 started on its own.
      walkTo(sim, LETTER_AT.x);
      for (const command of [INTERACT, INTERACT, SELECT_SLOT_1, USE_ITEM, USE_ITEM, USE_ITEM, INTERACT]) sim.step([command]);
      walkTo(sim, level3.start.x);
      expect(stickManOf(sim).carrying).toBe(true);
      // Back where the level starts him, so the walk to the edge takes as many ticks as it does from the start.
      const { furthestStoodAt, restarted } = playToTheEnd(sim, [WALK_RIGHT_AT_0, { atTick: jumpAtTick, command: { type: 'player/jump' } }]);
      expect(furthestStoodAt, `jumping at tick ${jumpAtTick}`).toBeLessThanOrEqual(GAP.from);
      expect(restarted, `jumping at tick ${jumpAtTick}`).toBe(true);
    }
  });

  it('cannot be finished by walking: he falls into the gap and the level starts again', () => {
    const sim = createSim({ level: 3 });
    const { furthestStoodAt, restarted } = playToTheEnd(sim, [WALK_RIGHT_AT_0]);
    expect(furthestStoodAt).toBeLessThanOrEqual(GAP.from);
    expect(restarted).toBe(true);
    expect(stickManOf(sim).feet).toEqual(level3.start);
  });

  it('is played as far as the edge: read the letter, fold the paper, set the airplane down, lift it, carry it and put it down on the edge', () => {
    // From level 2, so that the paper is the one its flag gave.
    const sim = createSim({ level: 2 });
    finishLevel2(sim);
    expect(sim.level).toBe(3);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
    expect(letterOf(sim)).toMatchObject({ at: LETTER_AT, height: 0, beingRead: false });

    // The paper alone folds into nothing: he has not learned how.
    sim.step([SELECT_SLOT_1]);
    sim.step([USE_ITEM]);
    expect(recipeListOf(sim)).toEqual({ open: true, recipes: [] });
    expect(itemUseOf(sim)).toBe('closeRecipes');
    sim.step([USE_ITEM]);
    expect(recipeListOf(sim).open).toBe(false);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);

    walkTo(sim, LETTER_AT.x);
    expect(interactionOf(sim)).toBe('read');
    sim.step([INTERACT]);
    expect(letterOf(sim)).toMatchObject({ beingRead: true });
    expect(letterOf(sim)!.text.length).toBeGreaterThan(0);
    expect(interactionOf(sim)).toBe('putLetterAway');
    sim.step([INTERACT]);
    expect(letterOf(sim)).toBeUndefined();

    expect(itemUseOf(sim)).toBe('openRecipes');
    sim.step([USE_ITEM]);
    expect(recipeListOf(sim)).toMatchObject({ open: true, recipes: [{ name: 'paper airplane' }] });
    expect(itemUseOf(sim)).toBe('craft');
    sim.step([USE_ITEM]);
    expect(recipeListOf(sim).open).toBe(false);
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
    expect(airplaneOf(sim)).toBeUndefined();

    expect(itemUseOf(sim)).toBe('place');
    sim.step([USE_ITEM]);
    expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
    const placedAt = stickManOf(sim).feet.x + AIRPLANE.putDownAhead;
    expect(airplaneOf(sim)).toMatchObject({ at: { x: placedAt, y: 0 }, facing: 1, state: 'resting', onAnEdge: false });

    expect(interactionOf(sim)).toBe('lift');
    sim.step([INTERACT]);
    expect(stickManOf(sim).carrying).toBe(true);
    expect(airplaneOf(sim)).toMatchObject({ state: 'carried', at: { x: stickManOf(sim).feet.x, y: -STICK_MAN_HEIGHT - AIRPLANE.carriedAbove } });

    walkTo(sim, GAP.from - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    expect(airplaneOf(sim)).toMatchObject({ state: 'carried', at: { x: stickManOf(sim).feet.x } });
    expect(interactionOf(sim)).toBe('putDown');
    sim.step([INTERACT]);
    expect(stickManOf(sim).carrying).toBe(false);
    const airplane = airplaneOf(sim)!;
    expect(airplane).toMatchObject({ state: 'resting', onAnEdge: true, facing: 1 });
    expect(airplane.at.x).toBeLessThan(GAP.from);
    expect(airplane.at.x + airplane.length / 2).toBeGreaterThan(GAP.from);

    // It stays there, and he still stands on the floor.
    for (let tick = 0; tick < 120; tick += 1) sim.step();
    expect(airplaneOf(sim)).toEqual(airplane);
    expect(stickManOf(sim).action).toBe('standing');
    expect(letterOf(sim)).toBeUndefined();
  });
});

// ---- Helpers ----

/** The gap: where the first floor segment ends and the second begins. */
const GAP = { from: level3.floor[0]!.to.x, to: level3.floor[1]!.from.x };
const LETTER_AT = level3.placements.find((placement) => placement.defId !== FLAG_DEF_ID)!.at;

const WALK_RIGHT_AT_0 = { atTick: 0, command: { type: 'player/walk', direction: 1 } } as const;
const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };
const USE_ITEM: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/** The last tick on which he still stands on the first segment, walking right from the start. */
const TICK_AT_THE_EDGE = Math.floor(((GAP.from - level3.start.x) / PLAYER.walkSpeed) * TICK_RATE) - 1;

/** Plays the commands for long enough to walk to the gap and fall all the way down it. Says how far right he ever stood on the floor, and whether the level started again. */
function playToTheEnd(sim: SimHandle, commands: readonly { readonly atTick: number; readonly command: Command }[]): { furthestStoodAt: number; restarted: boolean } {
  let furthestStoodAt = -Infinity;
  let restarted = false;
  let previousX = stickManOf(sim).feet.x;
  for (let tick = 0; tick < TICK_AT_THE_EDGE + 3 * TICK_RATE && !restarted; tick += 1) {
    sim.step(commands.filter(({ atTick }) => atTick === tick).map(({ command }) => command));
    const { feet, action } = stickManOf(sim);
    // He only ever goes back to where a level starts, without walking there, when the level starts again.
    if (Math.abs(feet.x - previousX) > 1) restarted = true;
    else if (action !== 'jumping') furthestStoodAt = Math.max(furthestStoodAt, feet.x);
    previousX = feet.x;
  }
  return { furthestStoodAt, restarted };
}

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: SimHandle, x: number): void {
  const direction = x > stickManOf(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - stickManOf(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}

/** Jumps level 2's gap, reaches its flag and waits for level 3 to start. */
function finishLevel2(sim: SimHandle): void {
  const gap = { from: level2.floor[0]!.to.x, to: level2.floor[1]!.from.x };
  walkTo(sim, gap.from - 0.25 * (gap.to - gap.from));
  sim.step([{ type: 'player/walk', direction: 1 }, { type: 'player/jump' }]);
  for (let tick = 0; tick < 600 && !flagOf(sim)!.reached; tick += 1) sim.step();
  for (let tick = 0; tick < Math.ceil(LEVEL_END.pauseBeforeNextLevel * TICK_RATE) + 1; tick += 1) sim.step();
}
