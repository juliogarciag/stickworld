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

  it('is finished the intended way: he boards the airplane on the edge, climbs for a moment, glides across, lands and walks to the flag, which ends the game', () => {
    const sim = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(sim);
    expect(interactionOf(sim)).toBe('board');
    sim.step([INTERACT]);

    let highest = 0;
    const seatedTicks = playFlight(sim, climbingFor(CLIMB_THAT_CROSSES.from + 8), ({ airplane, stickMan }) => {
      expect(stickMan.action).toBe('seated');
      expect(letterOf(sim)).toBeUndefined();
      highest = Math.max(highest, -airplane.at.y);
    });
    expect(seatedTicks).toBeGreaterThan(TICK_RATE);
    // He climbed above his own height on the way, and is now on his feet on the far side with the airplane next to him.
    expect(highest).toBeGreaterThan(STICK_MAN_HEIGHT);
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: { y: 0 } });
    expect(stickManOf(sim).feet.x).toBeGreaterThan(GAP.to);
    expect(airplaneOf(sim)).toMatchObject({ state: 'resting', at: stickManOf(sim).feet });
    expect(flagOf(sim)).toMatchObject({ reached: false, endsTheGame: true });

    walkTo(sim, FLAG_AT.x);
    expect(flagOf(sim)!.reached).toBe(true);
    // No level follows: he stays where he is, cheering, and the game is over.
    for (let tick = 0; tick < 3 * Math.ceil(LEVEL_END.pauseBeforeNextLevel * TICK_RATE); tick += 1) sim.step([WALK_RIGHT_AT_0.command]);
    expect(sim.level).toBe(3);
    expect(flagOf(sim)).toMatchObject({ reached: true, raised: 1, endsTheGame: true });
    expect(stickManOf(sim).action).toBe('cheering');
  });

  it('is hard but fair: every climb of a length in a window of about half a second crosses, and nothing but letting go is asked after it', () => {
    expect((CLIMB_THAT_CROSSES.to - CLIMB_THAT_CROSSES.from) / TICK_RATE).toBeGreaterThan(0.35);
    for (let ticks = CLIMB_THAT_CROSSES.from; ticks <= CLIMB_THAT_CROSSES.to; ticks += 1) {
      const sim = createSim({ level: 3 });
      putTheAirplaneOnTheEdge(sim);
      sim.step([INTERACT]);
      playFlight(sim, climbingFor(ticks));
      expect(stickManOf(sim), `climbing for ${ticks} ticks`).toMatchObject({ action: 'standing', feet: { y: 0 } });
      expect(stickManOf(sim).feet.x, `climbing for ${ticks} ticks`).toBeGreaterThan(GAP.to);
      // Short of the end of the paper, with room to walk to the flag or back to it.
      expect(stickManOf(sim).feet.x, `climbing for ${ticks} ticks`).toBeLessThan(level3.floor[1]!.to.x - 1);
    }
  });

  it('cannot be finished by boarding and doing nothing: left alone the airplane sinks into the gap, he dies and the level starts again', () => {
    const sim = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(sim);
    sim.step([INTERACT]);
    let wasOverTheFarSide = false;
    playFlight(sim, [], ({ airplane }) => (wasOverTheFarSide ||= isOverTheFarSide(airplane.at)));
    // It passes under the far line, never over it.
    expect(wasOverTheFarSide).toBe(false);
    expectTheLevelToHaveStartedAgainWithANewLetterToCome(sim);
  });

  it('cannot be finished by climbing all the way: climbing too steeply for too long it stalls, falls short of the far side and the level starts again', () => {
    for (const ticks of [CLIMB_THAT_CROSSES.to + 6, 2 * CLIMB_THAT_CROSSES.to, Infinity]) {
      const sim = createSim({ level: 3 });
      putTheAirplaneOnTheEdge(sim);
      sim.step([INTERACT]);
      let stalledAt: { x: number; y: number } | undefined;
      let wasOverTheFarSide = false;
      playFlight(sim, climbingFor(ticks), ({ airplane }) => {
        if (airplane.state === 'falling') stalledAt ??= airplane.at;
        wasOverTheFarSide ||= isOverTheFarSide(airplane.at);
      });
      // It stalled high over the gap, higher than any flight that crosses needs to go, and never got to the far side.
      expect(stalledAt, `climbing for ${ticks} ticks`).toBeDefined();
      expect(stalledAt!.x).toBeLessThan(GAP.to);
      expect(-stalledAt!.y).toBeGreaterThan(STICK_MAN_HEIGHT);
      expect(wasOverTheFarSide, `climbing for ${ticks} ticks`).toBe(false);
      expectTheLevelToHaveStartedAgainWithANewLetterToCome(sim);
    }
  });

  it('lets a flight that would fall just short be saved by jumping out near the far edge', () => {
    const tooShort = climbingFor(CLIMB_THAT_CROSSES.from - 2);
    const lost = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(lost);
    lost.step([INTERACT]);
    let ticksToTheFarEdge = 0;
    playFlight(lost, tooShort, ({ airplane }) => {
      if (airplane.at.x < GAP.to) ticksToTheFarEdge += 1;
    });
    expectTheLevelToHaveStartedAgainWithANewLetterToCome(lost);

    // The same flight, but a moment before it would pass under the far edge he jumps out, holding the walk key towards it.
    const saved = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(saved);
    saved.step([INTERACT]);
    const jumpAtTick = ticksToTheFarEdge - Math.round(0.12 * TICK_RATE);
    let jumpedFrom: { x: number; y: number } | undefined;
    for (let tick = 0; tick < 6 * TICK_RATE; tick += 1) {
      if (tick === jumpAtTick) jumpedFrom = stickManOf(saved).feet;
      const commands = tooShort.filter(({ atTick }) => atTick === tick).map(({ command }) => command);
      saved.step(tick === jumpAtTick ? [...commands, WALK_RIGHT_AT_0.command, { type: 'player/jump' }] : commands);
    }
    expect(jumpedFrom!.x).toBeLessThan(GAP.to);
    expect(stickManOf(saved).feet.y).toBe(0);
    expect(stickManOf(saved).feet.x).toBeGreaterThan(GAP.to);
    expect(flagOf(saved)!.reached).toBe(true);
    expect(saved.level).toBe(3);
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
const FLAG_AT = level3.placements.find((placement) => placement.defId === FLAG_DEF_ID)!.at;

/**
 * How long he can hold the nose up from the moment he boards, in ticks, and cross with nothing more than letting go:
 * every length from `from` to `to`. Shorter, the airplane sinks under the far edge; longer, it stalls over the gap.
 * The gap and the `FLIGHT` values are tuned together to keep this window; a change that narrows it fails here.
 */
const CLIMB_THAT_CROSSES = { from: 16, to: 42 };

/** True for a point above the floor line of the far side: where an airplane has to be to come down on it. */
function isOverTheFarSide(at: { readonly x: number; readonly y: number }): boolean {
  return at.x >= GAP.to && at.y < 0;
}

/** A recorded flight: the nose held up from the first tick after boarding for `ticks` ticks, then let go. */
function climbingFor(ticks: number): { atTick: number; command: Command }[] {
  return [
    { atTick: 0, command: { type: 'airplane/steer', direction: 1 } },
    ...(Number.isFinite(ticks) ? [{ atTick: ticks, command: { type: 'airplane/steer', direction: 0 } as Command }] : []),
  ];
}

/**
 * Plays a recorded flight from the tick after boarding for as long as he is seated, and returns how many ticks that
 * was. `seen` is shown the airplane and him after every tick he was seated on.
 */
function playFlight(
  sim: SimHandle,
  commands: readonly { readonly atTick: number; readonly command: Command }[],
  seen: (now: { airplane: NonNullable<ReturnType<typeof airplaneOf>>; stickMan: ReturnType<typeof stickManOf> }) => void = () => undefined,
): number {
  for (let tick = 0; tick < 20 * TICK_RATE; tick += 1) {
    sim.step(commands.filter(({ atTick }) => atTick === tick).map(({ command }) => command));
    const stickMan = stickManOf(sim);
    const airplane = airplaneOf(sim);
    if (stickMan.action !== 'seated' || !airplane) return tick;
    seen({ airplane, stickMan });
  }
  throw new Error('still seated after 20 seconds');
}

/** From the start of level 3 on its own: reads the letter, which gives the paper, folds it, sets the airplane down, lifts it, carries it to the edge and puts it down there. */
function putTheAirplaneOnTheEdge(sim: SimHandle): void {
  walkTo(sim, LETTER_AT.x);
  for (const command of [INTERACT, INTERACT, SELECT_SLOT_1, USE_ITEM, USE_ITEM, USE_ITEM, INTERACT]) sim.step([command]);
  walkTo(sim, GAP.from - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
  sim.step([INTERACT]);
  expect(airplaneOf(sim)).toMatchObject({ state: 'resting', onAnEdge: true });
}

/** He is back at the start with nothing: no airplane anywhere, an empty slot, the flag not reached, and a new letter on its way down. */
function expectTheLevelToHaveStartedAgainWithANewLetterToCome(sim: SimHandle): void {
  expect(sim.level).toBe(3);
  expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: level3.start });
  expect(airplaneOf(sim)).toBeUndefined();
  expect(itemSlotsOf(sim)[0]?.itemDefId).toBeNull();
  expect(flagOf(sim)!.reached).toBe(false);
  for (let tick = 0; tick < 2 * TICK_RATE && !letterOf(sim); tick += 1) sim.step();
  expect(letterOf(sim)!.height).toBeGreaterThan(0);
}

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
