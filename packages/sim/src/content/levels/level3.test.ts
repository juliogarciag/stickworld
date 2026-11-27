import { describe, expect, it } from 'vitest';
import type { Command } from '../../core/commands';
import { createSim } from '../../core/create';
import type { Sim, SimHandle } from '../../core/sim';
import { AIRPLANE } from '../../features/airplane/defs';
import { getAirplane } from '../../features/airplane/view';
import { getCrafting } from '../../features/crafting/view';
import { FLAG_DEF_ID, LEVEL_END } from '../../features/flag/defs';
import { getFlag } from '../../features/flag/view';
import { GAME_END } from '../../features/game/defs';
import { getGame } from '../../features/game/view';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from '../../features/inventory/defs';
import { getItemSlots } from '../../features/inventory/view';
import { getItemUse } from '../../features/item/view';
import { getFallenItem, getLetter } from '../../features/letter/view';
import { PLAYER } from '../../features/player/defs';
import { getStickMan } from '../../features/player/view';
import { getInteraction } from '../../features/world/view';
import { STICK_MAN_HEIGHT, STICK_MAN_WIDTH, TICK_RATE } from '../tuning';
import { levels } from './index';
import { level2 } from './level2';
import { level3 } from './level3';

describe('level 3', () => {
  it('has a gap several jumps long, with the flag on the far side and the letter just in front of the start', () => {
    const jumpSeconds = Math.sqrt((2 * PLAYER.jumpHeight) / PLAYER.riseGravity) + Math.sqrt((2 * PLAYER.jumpHeight) / PLAYER.fallGravity);
    const longestJump = PLAYER.walkSpeed * (jumpSeconds + PLAYER.jumpAskedLateWindow);
    expect(GAP.to - GAP.from).toBeGreaterThan(4 * longestJump);
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
      expect(getFlag(sim)!.reached).toBe(false);
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
      for (const command of [INTERACT, INTERACT, USE_ITEM, USE_ITEM, INTERACT]) sim.step([command]);
      walkTo(sim, level3.start.x);
      expect(getStickMan(sim).carrying).toBe(true);
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
    expect(getStickMan(sim).feet).toEqual(level3.checkpoint);
  });

  it('is played as far as the edge: read the letter, fold the paper, set the airplane down, lift it, carry it and put it down on the edge', () => {
    // From level 2, so that the paper is the one its flag gave.
    const sim = createSim({ level: 2 });
    finishLevel2(sim);
    expect(sim.level).toBe(3);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
    expect(getLetter(sim)).toMatchObject({ at: LETTER_AT, beingRead: false });

    // The paper alone has no use, in his hand or not: he has not learned what to make of it.
    expect(getItemSlots(sim)[0]?.selected).toBe(false);
    sim.step([SELECT_SLOT_1]);
    expect(getItemUse(sim)).toBeNull();
    sim.step([USE_ITEM]);
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
    sim.step([SELECT_SLOT_1]);

    walkTo(sim, LETTER_AT.x);
    expect(getInteraction(sim)).toBe('read');
    sim.step([INTERACT]);
    expect(getLetter(sim)).toMatchObject({ beingRead: true });
    expect(getLetter(sim)!.text.length).toBeGreaterThan(0);
    expect(getLetter(sim)!.teaches).toBe('paper airplane');
    // Reading put the paper in his hand, and while he reads the only thing a key does is put the letter away.
    expect(getItemSlots(sim)[0]).toMatchObject({ itemDefId: PAPER_ITEM_ID, selected: true });
    expect(getItemUse(sim)).toBeNull();
    expect(getInteraction(sim)).toBe('putLetterAway');
    sim.step([INTERACT]);
    expect(getLetter(sim)).toBeUndefined();

    // One press folds it.
    expect(getItemUse(sim)).toBe('craft');
    expect(getCrafting(sim).canMake).toMatchObject({ name: 'paper airplane' });
    sim.step([USE_ITEM]);
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
    expect(getAirplane(sim)).toBeUndefined();

    expect(getItemUse(sim)).toBe('place');
    sim.step([USE_ITEM]);
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
    const placedAt = getStickMan(sim).feet.x + AIRPLANE.putDownAhead;
    expect(getAirplane(sim)).toMatchObject({ at: { x: placedAt, y: 0 }, facing: 1, state: 'resting', onAnEdge: false });

    expect(getInteraction(sim)).toBe('lift');
    sim.step([INTERACT]);
    expect(getStickMan(sim).carrying).toBe(true);
    expect(getAirplane(sim)).toMatchObject({ state: 'carried', at: { x: getStickMan(sim).feet.x, y: -STICK_MAN_HEIGHT - AIRPLANE.carriedAbove } });

    walkTo(sim, GAP.from - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    expect(getAirplane(sim)).toMatchObject({ state: 'carried', at: { x: getStickMan(sim).feet.x } });
    expect(getInteraction(sim)).toBe('putDown');
    sim.step([INTERACT]);
    expect(getStickMan(sim).carrying).toBe(false);
    const airplane = getAirplane(sim)!;
    expect(airplane).toMatchObject({ state: 'resting', onAnEdge: true, facing: 1 });
    expect(airplane.at.x).toBeLessThan(GAP.from);
    expect(airplane.at.x + airplane.length / 2).toBeGreaterThan(GAP.from);

    // It stays there, and he still stands on the floor.
    for (let tick = 0; tick < 120; tick += 1) sim.step();
    expect(getAirplane(sim)).toEqual(airplane);
    expect(getStickMan(sim).action).toBe('standing');
    expect(getLetter(sim)).toBeUndefined();
  });

  it('is finished the intended way: he boards the airplane on the edge, climbs for a moment, glides across, lands and walks to the flag, which ends the game', () => {
    const sim = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(sim);
    expect(getInteraction(sim)).toBe('board');
    sim.step([INTERACT]);

    let highest = 0;
    const seatedTicks = playFlight(sim, makeClimbFor(CLIMB_THAT_CROSSES.from + 8), ({ airplane, stickMan }) => {
      expect(stickMan.action).toBe('seated');
      expect(getLetter(sim)).toBeUndefined();
      highest = Math.max(highest, -airplane.at.y);
    });
    expect(seatedTicks).toBeGreaterThan(TICK_RATE);
    // He climbed above his own height on the way, and is now on his feet on the far side with the airplane next to him.
    expect(highest).toBeGreaterThan(STICK_MAN_HEIGHT);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: { y: 0 } });
    expect(getStickMan(sim).feet.x).toBeGreaterThan(GAP.to);
    expect(getAirplane(sim)).toMatchObject({ state: 'resting', at: getStickMan(sim).feet });
    expect(getFlag(sim)).toMatchObject({ reached: false, endsTheGame: true });

    walkUntilTheFlagIsReached(sim);
    // No level follows: the game is over. He stays where he is, cheering, until playing again is offered.
    const stoodAt = getStickMan(sim).feet;
    for (let tick = 0; tick < Math.round(GAME_END.playAgainAfter * TICK_RATE) - 5; tick += 1) sim.step([WALK_RIGHT_AT_0.command]);
    expect(sim.level).toBe(3);
    expect(getFlag(sim)).toMatchObject({ reached: true, raised: 1, endsTheGame: true });
    expect(getStickMan(sim)).toMatchObject({ action: 'cheering', feet: stoodAt });
    expect(getGame(sim)).toEqual({ over: true, playingAgainOffered: false });
  });

  it('is not a dead end: after the end he walks and jumps about on the far side, cannot leave it, and playing again starts the game over', () => {
    const sim = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(sim);
    sim.step([INTERACT]);
    playFlight(sim, makeClimbFor(CLIMB_THAT_CROSSES.from + 8));
    walkUntilTheFlagIsReached(sim);
    sim.step([{ type: 'game/playAgain' }]);
    expect(sim.level).toBe(3);
    for (let tick = 0; tick < Math.round(GAME_END.playAgainAfter * TICK_RATE) + 1; tick += 1) sim.step();
    expect(getGame(sim)).toEqual({ over: true, playingAgainOffered: true });
    expect(getStickMan(sim).action).toBe('standing');

    // Holding a walk key for as long as he likes, jumping all the way, he ends up at the end of the line and not past it.
    const farSide = level3.floor[1]!;
    for (const [direction, end] of [[1, farSide.to.x], [-1, farSide.from.x]] as const) {
      sim.step([{ type: 'player/walk', direction }]);
      const actions = new Set<string>();
      for (let tick = 0; tick < 12 * TICK_RATE; tick += 1) {
        sim.step(tick % 40 === 0 ? [{ type: 'player/jump' }] : []);
        actions.add(getStickMan(sim).action);
        expect(getStickMan(sim).feet.y).toBeLessThanOrEqual(0);
      }
      expect([...actions].sort()).toEqual(['jumping', 'walking']);
      expect(Math.abs(getStickMan(sim).feet.x - end)).toBeCloseTo(STICK_MAN_WIDTH / 2, 9);
      expect(sim.level).toBe(3);
      expect(getFlag(sim)!.reached).toBe(true);
    }

    // Neither key has a use after the end: the airplane he came in stays where it lies.
    walkTo(sim, getAirplane(sim)!.at.x);
    expect(getInteraction(sim)).toBeNull();
    expect(getItemUse(sim)).toBeNull();

    sim.step([{ type: 'game/playAgain' }]);
    expect(sim.level).toBe(1);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: levels[0]!.start });
    expect(getGame(sim)).toEqual({ over: false, playingAgainOffered: false });
    // Nothing is kept from the game before: no item, and the fold is not known.
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: null, selected: false }]);
    expect(getCrafting(sim).knownRecipes).toEqual([]);
    expect(getAirplane(sim)).toBeUndefined();
    // The letter he read in the game before is not remembered: on level 3 it lies there again.
    (sim as Sim).startLevel(3);
    expect(getLetter(sim)).toMatchObject({ beingRead: false });
    expect(getItemSlots(sim)[0]?.itemDefId).toBeNull();
  });

  it('has its checkpoint on the way from the start to the edge of the gap, past the letter', () => {
    expect(level3.checkpoint!.x).toBeGreaterThan(LETTER_AT.x);
    expect(level3.checkpoint!.x).toBeLessThan(GAP.from);
  });

  it('is tried again without the chores: after a flight is lost the level starts again with the airplane in his hand, and a retry is walk, set down, board', () => {
    const sim = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(sim);
    sim.step([INTERACT]);
    playFlight(sim, []);
    expectTheLevelToHaveStartedAgainWithTheAirplaneInHisHand(sim);

    walkTo(sim, GAP.from - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
    expect(getItemUse(sim)).toBe('place');
    sim.step([USE_ITEM]);
    expect(getInteraction(sim)).toBe('board');
    sim.step([INTERACT]);
    expect(getStickMan(sim).action).toBe('seated');
    playFlight(sim, makeClimbFor(CLIMB_THAT_CROSSES.from + 8));
    expect(getStickMan(sim).feet.x).toBeGreaterThan(GAP.to);
  });

  it('is hard but fair: every climb of a length in a window of about half a second crosses, and nothing but letting go is asked after it', () => {
    expect((CLIMB_THAT_CROSSES.to - CLIMB_THAT_CROSSES.from) / TICK_RATE).toBeGreaterThan(0.35);
    for (let ticks = CLIMB_THAT_CROSSES.from; ticks <= CLIMB_THAT_CROSSES.to; ticks += 1) {
      const sim = createSim({ level: 3 });
      putTheAirplaneOnTheEdge(sim);
      sim.step([INTERACT]);
      playFlight(sim, makeClimbFor(ticks));
      expect(getStickMan(sim), `climbing for ${ticks} ticks`).toMatchObject({ action: 'standing', feet: { y: 0 } });
      expect(getStickMan(sim).feet.x, `climbing for ${ticks} ticks`).toBeGreaterThan(GAP.to);
      // Short of the end of the paper, with room to walk to the flag or back to it.
      expect(getStickMan(sim).feet.x, `climbing for ${ticks} ticks`).toBeLessThan(level3.floor[1]!.to.x - 1);
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
    expectTheLevelToHaveStartedAgainWithTheAirplaneInHisHand(sim);
  });

  it('cannot be finished by sinking under the far edge and climbing back up through the line: the line stops the airplane and it falls', () => {
    let flightsThatWentUnder = 0;
    for (const climbFromTick of [36, 40, 44, 50, 60]) {
      for (const firstSteer of [0, -1] as const) {
        const sim = createSim({ level: 3 });
        putTheAirplaneOnTheEdge(sim);
        sim.step([INTERACT]);
        let wasUnderTheFarSide = false;
        let cameUpThroughIt = false;
        const flight = [
          { atTick: 0, command: { type: 'airplane/steer', direction: firstSteer } as Command },
          { atTick: climbFromTick, command: { type: 'airplane/steer', direction: 1 } as Command },
        ];
        playFlight(sim, flight, ({ airplane }) => {
          wasUnderTheFarSide ||= airplane.at.x >= GAP.to && airplane.at.x <= level3.floor[1]!.to.x && airplane.at.y > 0;
          cameUpThroughIt ||= wasUnderTheFarSide && isOverTheFarSide(airplane.at) && airplane.at.x <= level3.floor[1]!.to.x;
        });
        // A flight that pulled up in time, over the gap, is a flight like any other; these are the ones that did not.
        if (!wasUnderTheFarSide) continue;
        flightsThatWentUnder += 1;
        expect(cameUpThroughIt, `steering ${firstSteer}, then up from tick ${climbFromTick}`).toBe(false);
        expectTheLevelToHaveStartedAgainWithTheAirplaneInHisHand(sim);
      }
    }
    expect(flightsThatWentUnder).toBeGreaterThanOrEqual(5);
  });

  it('cannot be finished by climbing all the way: climbing too steeply for too long it stalls, falls short of the far side and the level starts again', () => {
    for (const ticks of [CLIMB_THAT_CROSSES.to + 6, 2 * CLIMB_THAT_CROSSES.to, Infinity]) {
      const sim = createSim({ level: 3 });
      putTheAirplaneOnTheEdge(sim);
      sim.step([INTERACT]);
      let stalledAt: { x: number; y: number } | undefined;
      let wasOverTheFarSide = false;
      playFlight(sim, makeClimbFor(ticks), ({ airplane }) => {
        if (airplane.state === 'falling') stalledAt ??= airplane.at;
        wasOverTheFarSide ||= isOverTheFarSide(airplane.at);
      });
      // It stalled high over the gap, higher than any flight that crosses needs to go, and never got to the far side.
      expect(stalledAt, `climbing for ${ticks} ticks`).toBeDefined();
      expect(stalledAt!.x).toBeLessThan(GAP.to);
      expect(-stalledAt!.y).toBeGreaterThan(STICK_MAN_HEIGHT);
      expect(wasOverTheFarSide, `climbing for ${ticks} ticks`).toBe(false);
      expectTheLevelToHaveStartedAgainWithTheAirplaneInHisHand(sim);
    }
  });

  it('lets a flight that would fall just short be saved by jumping out near the far edge', () => {
    const tooShort = makeClimbFor(CLIMB_THAT_CROSSES.from - 2);
    const lost = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(lost);
    lost.step([INTERACT]);
    let ticksToTheFarEdge = 0;
    playFlight(lost, tooShort, ({ airplane }) => {
      if (airplane.at.x < GAP.to) ticksToTheFarEdge += 1;
    });
    expectTheLevelToHaveStartedAgainWithTheAirplaneInHisHand(lost);

    // The same flight, but a moment before it would pass under the far edge he jumps out, holding the walk key towards it.
    const saved = createSim({ level: 3 });
    putTheAirplaneOnTheEdge(saved);
    saved.step([INTERACT]);
    const jumpAtTick = ticksToTheFarEdge - Math.round(JUMPS_OUT_BEFORE_THE_EDGE * TICK_RATE);
    let jumpedFrom: { x: number; y: number } | undefined;
    for (let tick = 0; tick < 6 * TICK_RATE; tick += 1) {
      if (tick === jumpAtTick) jumpedFrom = getStickMan(saved).feet;
      const commands = tooShort.filter(({ atTick }) => atTick === tick).map(({ command }) => command);
      saved.step(tick === jumpAtTick ? [...commands, WALK_RIGHT_AT_0.command, { type: 'player/jump' }] : commands);
    }
    expect(jumpedFrom!.x).toBeLessThan(GAP.to);
    expect(getStickMan(saved).feet.y).toBe(0);
    expect(getStickMan(saved).feet.x).toBeGreaterThan(GAP.to);
    expect(getFlag(saved)!.reached).toBe(true);
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

/** How long before the airplane would pass under the far edge he jumps out of it, in seconds: at the last moment. */
const JUMPS_OUT_BEFORE_THE_EDGE = 0.12;

/** A recorded flight: the nose held up from the first tick after boarding for `ticks` ticks, then let go. */
function makeClimbFor(ticks: number): { atTick: number; command: Command }[] {
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
  seen: (now: { airplane: NonNullable<ReturnType<typeof getAirplane>>; stickMan: ReturnType<typeof getStickMan> }) => void = () => undefined,
): number {
  for (let tick = 0; tick < 20 * TICK_RATE; tick += 1) {
    sim.step(commands.filter(({ atTick }) => atTick === tick).map(({ command }) => command));
    const stickMan = getStickMan(sim);
    const airplane = getAirplane(sim);
    if (stickMan.action !== 'seated' || !airplane) return tick;
    seen({ airplane, stickMan });
  }
  throw new Error('still seated after 20 seconds');
}

/** From the start of level 3 on its own: reads the letter, which gives the paper, folds it, sets the airplane down, lifts it, carries it to the edge and puts it down there. */
function putTheAirplaneOnTheEdge(sim: SimHandle): void {
  walkTo(sim, LETTER_AT.x);
  for (const command of [INTERACT, INTERACT, USE_ITEM, USE_ITEM, INTERACT]) sim.step([command]);
  walkTo(sim, GAP.from - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
  sim.step([INTERACT]);
  expect(getAirplane(sim)).toMatchObject({ state: 'resting', onAnEdge: true });
}

/** He is back at the checkpoint, which every way to the gap goes past, with the airplane as the item in his hand, none in the world, the flag not reached, and neither a letter there nor a sheet of paper on its way. */
function expectTheLevelToHaveStartedAgainWithTheAirplaneInHisHand(sim: SimHandle): void {
  expect(sim.level).toBe(3);
  expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: level3.checkpoint });
  expect(getAirplane(sim)).toBeUndefined();
  expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
  expect(getFlag(sim)!.reached).toBe(false);
  for (let tick = 0; tick < 3 * TICK_RATE; tick += 1) {
    sim.step();
    expect(getLetter(sim)).toBeUndefined();
    expect(getFallenItem(sim)).toBeUndefined();
  }
}

/** The last tick on which he still stands on the first segment, walking right from the start. */
const TICK_AT_THE_EDGE = Math.floor(((GAP.from - level3.start.x) / PLAYER.walkSpeed) * TICK_RATE) - 1;

/** Plays the commands for long enough to walk to the gap and fall all the way down it. Says how far right he ever stood on the floor, and whether the level started again. */
function playToTheEnd(sim: SimHandle, commands: readonly { readonly atTick: number; readonly command: Command }[]): { furthestStoodAt: number; restarted: boolean } {
  let furthestStoodAt = -Infinity;
  let restarted = false;
  let previousX = getStickMan(sim).feet.x;
  for (let tick = 0; tick < TICK_AT_THE_EDGE + 3 * TICK_RATE && !restarted; tick += 1) {
    sim.step(commands.filter(({ atTick }) => atTick === tick).map(({ command }) => command));
    const { feet, action } = getStickMan(sim);
    // He only ever goes back to where a level starts, without walking there, when the level starts again.
    if (Math.abs(feet.x - previousX) > 1) restarted = true;
    else if (action !== 'jumping') furthestStoodAt = Math.max(furthestStoodAt, feet.x);
    previousX = feet.x;
  }
  return { furthestStoodAt, restarted };
}

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: SimHandle, x: number): void {
  const direction = x > getStickMan(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - getStickMan(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}

/** Walks him right from where he is until the tick the flag is reached, and lets go of the key. */
function walkUntilTheFlagIsReached(sim: SimHandle): void {
  sim.step([WALK_RIGHT_AT_0.command]);
  for (let tick = 0; tick < 3000 && !getFlag(sim)!.reached; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
  expect(getFlag(sim)!.reached).toBe(true);
  expect(Math.abs(getStickMan(sim).feet.x - FLAG_AT.x)).toBeLessThan(0.5);
}

/** Jumps level 2's gap, reaches its flag and waits for level 3 to start. */
function finishLevel2(sim: SimHandle): void {
  const gap = { from: level2.floor[0]!.to.x, to: level2.floor[1]!.from.x };
  walkTo(sim, gap.from - 0.25 * (gap.to - gap.from));
  sim.step([{ type: 'player/walk', direction: 1 }, { type: 'player/jump' }]);
  for (let tick = 0; tick < 600 && !getFlag(sim)!.reached; tick += 1) sim.step();
  for (let tick = 0; tick < Math.ceil(LEVEL_END.pauseBeforeNextLevel * TICK_RATE) + 1; tick += 1) sim.step();
}
