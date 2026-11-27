import { describe, expect, it } from 'vitest';
import { level3 } from '../../content/levels/level3';
import { TICK_RATE } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { hashSnapshot } from '../../core/snapshot';
import { features } from '..';
import { flagPlacedIn } from '../flag';
import { flagDef } from '../flag/defs';
import { flagOf } from '../flag/view';
import { AIRPLANE_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { itemSlotsOf } from '../inventory/view';
import { LETTER } from '../letter/defs';
import { fallenItemOf, letterOf } from '../letter/view';
import { PLAYER } from '../player/defs';
import { stickManOf } from '../player/view';
import { interactionOf } from '../world/view';
import { AIRPLANE, FLIGHT } from './defs';
import { hasAirplane } from './index';
import { airplaneOf, steeringAskedOf } from './view';

describe('boarding', () => {
  it('seats him in the airplane and launches it forward off the edge, nose a little up', () => {
    const sim = readyToBoard();
    const resting = airplaneOf(sim)!;
    sim.step([INTERACT]);
    const airplane = airplaneOf(sim)!;
    expect(airplane).toMatchObject({ state: 'flying', facing: 1, onAnEdge: false });
    expect(airplane.pitch).toBeCloseTo(FLIGHT.launchPitch, 1);
    expect(airplane.speed).toBeCloseTo(FLIGHT.launchSpeed, 0);
    expect(airplane.at.x).toBeGreaterThan(resting.at.x);
    expect(airplane.at.y).toBeLessThan(resting.at.y);
    expect(stickManOf(sim)).toMatchObject({ action: 'seated', feet: airplane.at, facing: 1, carrying: false });
    expect(interactionOf(sim)).toBeNull();
  });

  it('keeps him from walking or turning: the walk keys do nothing while he is seated', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    sim.step([{ type: 'player/walk', direction: -1 }]);
    let previousX = airplaneOf(sim)!.at.x;
    for (let tick = 0; tick < 30; tick += 1) {
      sim.step();
      const airplane = airplaneOf(sim)!;
      expect(stickManOf(sim)).toMatchObject({ action: 'seated', feet: airplane.at, facing: 1 });
      expect(airplane.at.x).toBeGreaterThan(previousX);
      previousX = airplane.at.x;
    }
  });

  it('is not undone by a jump that arrives on the same tick, before or after the interaction: he stays seated', () => {
    for (const commands of [[INTERACT, JUMP], [JUMP, INTERACT]]) {
      const sim = readyToBoard();
      sim.step(commands);
      expect(stickManOf(sim).action).toBe('seated');
      expect(airplaneOf(sim)!.state).toBe('flying');
      for (let tick = 0; tick < 10; tick += 1) sim.step();
      expect(stickManOf(sim).action).toBe('seated');
      // The next jump is his own: it takes him out.
      sim.step([JUMP]);
      expect(stickManOf(sim).action).toBe('jumping');
    }
  });

  it('cannot be interacted with while it flies: the press does nothing', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    const compared = readyToBoard();
    compared.step([INTERACT]);
    sim.step([INTERACT]);
    compared.step();
    expect(sim.snapshot().slices).toEqual(compared.snapshot().slices);
  });
});

describe('the glide', () => {
  it('pays for every metre climbed with speed, by the tuning values', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    const before = airplaneOf(sim)!;
    const ticks = 20;
    sim.step([STEER_UP]);
    for (let tick = 1; tick < ticks; tick += 1) sim.step();
    const after = airplaneOf(sim)!;
    const climbed = before.at.y - after.at.y;
    expect(climbed).toBeGreaterThan(0.5);
    expect(before.speed - after.speed).toBeCloseTo(climbed * FLIGHT.speedLostPerMetreClimbed + (ticks / TICK_RATE) * FLIGHT.speedLostPerSecond, 6);
  });

  it('gives speed back for every metre dived, less than the climb cost', () => {
    const sim = flyingHighWithItsNoseDown();
    const before = airplaneOf(sim)!;
    const ticks = 15;
    for (let tick = 0; tick < ticks; tick += 1) sim.step();
    const after = airplaneOf(sim)!;
    const dived = after.at.y - before.at.y;
    expect(dived).toBeGreaterThan(0.2);
    expect(after.speed).toBeGreaterThan(before.speed);
    expect(after.speed - before.speed).toBeCloseTo(dived * FLIGHT.speedGainedPerMetreDived - (ticks / TICK_RATE) * FLIGHT.speedLostPerSecond, 6);
    expect(FLIGHT.speedGainedPerMetreDived).toBeLessThan(FLIGHT.speedLostPerMetreClimbed);
  });

  it('goes where its nose points: forward and up by its speed', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    const before = airplaneOf(sim)!;
    sim.step([STEER_UP]);
    const after = airplaneOf(sim)!;
    expect(after.pitch).toBeCloseTo(before.pitch + FLIGHT.pitchRate / TICK_RATE, 9);
    expect(after.at.x - before.at.x).toBeCloseTo((before.speed * Math.cos(after.pitch)) / TICK_RATE, 9);
    expect(before.at.y - after.at.y).toBeCloseTo((before.speed * Math.sin(after.pitch)) / TICK_RATE, 9);
  });

  it('turns its nose no further than the steepest climb and the steepest dive', () => {
    const climbing = readyToBoard();
    climbing.step([INTERACT]);
    climbing.step([STEER_UP]);
    const pitches = whileItFlies(climbing, (airplane) => airplane.pitch);
    expect(Math.max(...pitches)).toBe(FLIGHT.steepestClimb);

    const diving = readyToBoard();
    diving.step([INTERACT]);
    diving.step([STEER_DOWN]);
    expect(Math.min(...whileItFlies(diving, (airplane) => airplane.pitch))).toBe(FLIGHT.steepestDive);
  });

  it('left alone, sinks its nose to where it rests and glides down from there', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    const pitches = whileItFlies(sim, (airplane) => airplane.pitch);
    expect(pitches).toEqual([...pitches].sort((one, other) => other - one));
    expect(pitches[pitches.length - 1]).toBe(FLIGHT.restingPitch);
    expect(FLIGHT.restingPitch).toBeLessThan(0);
  });

  it('never goes faster than its fastest speed, however far it dives', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    sim.step([STEER_DOWN]);
    expect(Math.max(...whileItFlies(sim, (airplane) => airplane.speed))).toBeLessThanOrEqual(FLIGHT.fastestSpeed);
  });

  it('stalls below the stall speed: it stops flying and falls, with him still in it', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    sim.step([STEER_UP]);
    const speeds = whileItFlies(sim, (airplane) => airplane.speed);
    expect(speeds[speeds.length - 1]).toBeGreaterThanOrEqual(FLIGHT.stallSpeed);
    expect(speeds[speeds.length - 1]).toBeLessThan(FLIGHT.stallSpeed + 0.2);
    expect(airplaneOf(sim)!.state).toBe('falling');
    expect(airplaneOf(sim)!.at.x).toBeLessThan(FAR_SIDE);

    // Steering does nothing for it now: it drops faster and faster, and he goes with it.
    sim.step([STEER_DOWN]);
    let previous = airplaneOf(sim)!;
    for (let tick = 0; tick < 20; tick += 1) {
      sim.step([tick % 2 === 0 ? STEER_UP : STEER_DOWN]);
      const airplane = airplaneOf(sim)!;
      expect(airplane.state).toBe('falling');
      expect(airplane.verticalSpeed - previous.verticalSpeed).toBeCloseTo(AIRPLANE.gravity / TICK_RATE, 9);
      expect(stickManOf(sim)).toMatchObject({ action: 'seated', feet: airplane.at });
      previous = airplane;
    }
  });
});

describe("'airplane/steer'", () => {
  it('is remembered until the next one, and ignores what is malformed', () => {
    const sim = readyToBoard();
    sim.step([STEER_UP]);
    expect(steeringAskedOf(sim)).toBe(1);
    const malformed = [{ type: 'airplane/steer' }, { type: 'airplane/steer', direction: 2 }, { type: 'airplane/steer', direction: 'up' }, { type: 'airplane/steer', direction: null }, { type: 'airplane/steer', direction: 0.5 }];
    for (const command of malformed) {
      sim.step([command as unknown as Command]);
      expect(steeringAskedOf(sim)).toBe(1);
    }
    sim.step([STEER_DOWN]);
    expect(steeringAskedOf(sim)).toBe(-1);
    sim.step([{ type: 'airplane/steer', direction: 0 }]);
    expect(steeringAskedOf(sim)).toBe(0);
  });

  it('does nothing to an airplane that is not flying', () => {
    const sim = readyToBoard();
    const resting = airplaneOf(sim);
    sim.step([STEER_UP]);
    for (let tick = 0; tick < 30; tick += 1) sim.step();
    expect(airplaneOf(sim)).toEqual(resting);
    expect(stickManOf(sim).action).toBe('standing');
  });
});

describe('landing', () => {
  it('comes down on the line, slides to a stop losing its speed, and he stands up where it lies', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    const states = flown(sim, A_FLIGHT_THAT_CROSSES).map((airplane) => airplane.state);
    expect(collapsed(states)).toEqual(['flying', 'landing', 'resting']);

    const airplane = airplaneOf(sim)!;
    expect(airplane).toMatchObject({ state: 'resting', speed: 0, pitch: 0, verticalSpeed: 0, at: { y: 0 } });
    expect(airplane.at.x).toBeGreaterThan(FAR_SIDE);
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: airplane.at });
    // It is an airplane on the floor like any other: he can lift it again.
    expect(interactionOf(sim)).toBe('lift');
  });

  it('loses its speed by the tuning value while it slides, with him still seated', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    const sliding = flown(sim, A_FLIGHT_THAT_CROSSES).filter((airplane) => airplane.state === 'landing');
    expect(sliding.length).toBeGreaterThan(5);
    for (let index = 1; index < sliding.length; index += 1) {
      expect(sliding[index - 1]!.speed - sliding[index]!.speed).toBeCloseTo(FLIGHT.landingSlowdown / TICK_RATE, 9);
      expect(sliding[index]!.at.y).toBe(0);
    }
  });

  it('does not reach the flag while he is seated: flying or sliding past it does not finish the level, standing next to it does', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    const flag = flagPlacedIn(level3)!;
    let passedTheFlagSeated = false;
    for (const command of [STEER_UP, ...Array.from({ length: 41 }, () => undefined), STEER_LEVEL, ...Array.from({ length: 400 }, () => undefined)]) {
      sim.step(command ? [command] : []);
      const { action, feet } = stickManOf(sim);
      if (action !== 'seated') break;
      expect(flagOf(sim)!.reached).toBe(false);
      if (Math.abs(feet.x - flag.at.x) <= flagDef.reach && feet.y > -flagDef.height) passedTheFlagSeated = true;
    }
    expect(passedTheFlagSeated).toBe(true);
    expect(stickManOf(sim).action).toBe('standing');
    walkTo(sim, flag.at.x);
    expect(flagOf(sim)!.reached).toBe(true);
  });
});

describe('a floor line', () => {
  it('is not flown through from below: under it the airplane stops gliding and falls, with him in it', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    // Left alone it sinks under the far line; then the nose is held up.
    for (let tick = 0; tick < 600 && airplaneOf(sim)!.at.x < FAR_SIDE; tick += 1) sim.step();
    expect(airplaneOf(sim)!.at.y).toBeGreaterThan(0);
    sim.step([STEER_UP]);
    let highest = Infinity;
    for (let tick = 0; tick < 10 * TICK_RATE && stickManOf(sim).action === 'seated'; tick += 1) {
      highest = Math.min(highest, airplaneOf(sim)!.at.y);
      sim.step();
    }
    expect(highest).toBeGreaterThan(0);
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: level3.checkpoint });
    expect(airplaneOf(sim)).toBeUndefined();
  });

  it('is not jumped through from below either: under it a jump is dropped, he stays seated and falls with the airplane', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    // A climb too short to cross: it passes under the far edge.
    sim.step([STEER_UP]);
    for (let tick = 1; tick < 600 && airplaneOf(sim)!.at.x < FAR_SIDE + 0.5; tick += 1) sim.step(tick === 14 ? [STEER_LEVEL] : []);
    expect(airplaneOf(sim)!.at.y).toBeGreaterThan(0);
    for (let tick = 0; tick < 10 * TICK_RATE && stickManOf(sim).action === 'seated'; tick += 1) {
      sim.step([{ type: 'player/walk', direction: 1 }, JUMP]);
      expect(stickManOf(sim).action).not.toBe('jumping');
    }
    expect(stickManOf(sim)).toMatchObject({ feet: level3.checkpoint });
    expect(flagOf(sim)!.reached).toBe(false);
    expect(airplaneOf(sim)).toBeUndefined();
  });

  it('is slid off when it comes down too late: past the end of the paper it falls with him still in it, and the level starts again', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    const lateLanding = [
      { atTick: 0, command: STEER_UP },
      { atTick: 20, command: STEER_LEVEL },
      { atTick: 95, command: STEER_UP },
      { atTick: 125, command: STEER_LEVEL },
    ];
    const states = collapsed(flown(sim, lateLanding).map((airplane) => airplane.state));
    expect(states.slice(-2)).toEqual(['landing', 'falling']);
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: level3.checkpoint });
    expect(airplaneOf(sim)).toBeUndefined();
  });
});

describe('jumping out', () => {
  it('stands him up and jumps him out of his seat; the airplane falls on without him', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    for (let tick = 0; tick < 25; tick += 1) sim.step();
    const seatedAt = stickManOf(sim).feet;
    const flying = airplaneOf(sim)!;
    sim.step([{ type: 'player/jump' }]);
    expect(stickManOf(sim)).toMatchObject({ action: 'jumping', fallingOffAnEdge: false });
    expect(stickManOf(sim).verticalSpeed).toBeCloseTo(-Math.sqrt(2 * PLAYER.riseGravity * PLAYER.jumpHeight) + PLAYER.riseGravity / TICK_RATE, 9);
    expect(stickManOf(sim).feet.y).toBeLessThan(seatedAt.y);
    const unmanned = airplaneOf(sim)!;
    expect(unmanned.state).toBe('falling');
    // It keeps the sideways and the downward part of the way it was going.
    expect(unmanned.speed).toBeCloseTo(flying.speed * Math.cos(flying.pitch), 9);
    expect(unmanned.at.x).toBeGreaterThan(flying.at.x);

    // No walk key held: he comes straight down into the gap, the level starts again and the airplane that flew on is gone.
    for (let tick = 0; tick < 5 * TICK_RATE && stickManOf(sim).action === 'jumping'; tick += 1) sim.step();
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: level3.checkpoint });
    expect(airplaneOf(sim)).toBeUndefined();
  });

  it('early, walking back to the near side, saves him and loses the airplane: he is not left with one he cannot reach, and a new sheet of paper falls', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    sim.step([{ type: 'player/walk', direction: -1 }, { type: 'player/jump' }]);
    for (let tick = 0; tick < 12 * TICK_RATE && !fallenItemOf(sim); tick += 1) sim.step();
    expect(stickManOf(sim).feet.x).toBeLessThanOrEqual(EDGE);
    expect(hasAirplane(sim)).toBe(false);
    expect(fallenItemOf(sim)!.height).toBeGreaterThan(0);
  });

  it('leaves an airplane that comes down over the floor lying there, to be lifted again', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    sim.step([STEER_UP]);
    for (let tick = 1; tick < 500 && airplaneOf(sim)!.at.x < FAR_SIDE + 1; tick += 1) sim.step(tick === 30 ? [STEER_LEVEL] : []);
    expect(airplaneOf(sim)!.state).toBe('flying');
    sim.step([{ type: 'player/jump' }]);
    for (let tick = 0; tick < 3 * TICK_RATE; tick += 1) sim.step();
    expect(airplaneOf(sim)).toMatchObject({ state: 'resting', at: { y: 0 }, speed: 0 });
    expect(airplaneOf(sim)!.at.x).toBeGreaterThan(FAR_SIDE);
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: { y: 0 } });
    expect(stickManOf(sim).feet.x).toBeGreaterThan(FAR_SIDE);
    expect(hasAirplane(sim)).toBe(true);
  });
});

describe('falling while flying', () => {
  it('starts the level again once the airplane is out of sight below the floor, and that airplane is lost with it', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    let deepest = 0;
    let ticks = 0;
    for (; ticks < 10 * TICK_RATE && stickManOf(sim).action === 'seated'; ticks += 1) {
      deepest = Math.max(deepest, airplaneOf(sim)!.at.y);
      expect(letterOf(sim)).toBeUndefined();
      sim.step();
    }
    expect(deepest).toBeGreaterThan(FLIGHT.lostBelowFloor - 0.2);
    expect(deepest).toBeLessThanOrEqual(FLIGHT.lostBelowFloor);
    expect(stickManOf(sim)).toMatchObject({ action: 'standing', feet: level3.checkpoint });
    expect(sim.level).toBe(3);
    expect(airplaneOf(sim)).toBeUndefined();
    // He has read the letter, so he starts again with a new airplane in his hand and no letter has to fall.
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, selected: true }]);
    for (let tick = 0; tick < Math.round(LETTER.fallsAfter * TICK_RATE) + 2; tick += 1) sim.step();
    expect(fallenItemOf(sim)).toBeUndefined();
  });
});

describe('a flight', () => {
  it('is all in the snapshot: restored in the middle of it, it goes on exactly as it would have', () => {
    const sim = readyToBoard();
    sim.step([INTERACT]);
    sim.step([STEER_UP]);
    for (let tick = 0; tick < 20; tick += 1) sim.step();
    const restored = new Sim({ features, snapshot: sim.snapshot() });
    for (let tick = 0; tick < 200; tick += 1) {
      const commands = tick === 10 ? [STEER_LEVEL] : [];
      sim.step(commands);
      restored.step(commands);
    }
    expect(hashSnapshot(restored.snapshot())).toBe(hashSnapshot(sim.snapshot()));
    expect(stickManOf(sim).feet.x).toBeGreaterThan(FAR_SIDE);
  });
});

// ---- Helpers ----

const EDGE = level3.floor[0]!.to.x;
const FAR_SIDE = level3.floor[1]!.from.x;

const INTERACT: Command = { type: 'world/interact' };
const JUMP: Command = { type: 'player/jump' };
const STEER_UP: Command = { type: 'airplane/steer', direction: 1 };
const STEER_LEVEL: Command = { type: 'airplane/steer', direction: 0 };
const STEER_DOWN: Command = { type: 'airplane/steer', direction: -1 };

/** Climb for 24 ticks from the first tick of the flight, then let it glide: one of the flights that crosses level 3's gap (`level3.test.ts` has the whole range). */
const A_FLIGHT_THAT_CROSSES: readonly { readonly atTick: number; readonly command: Command }[] = [
  { atTick: 0, command: STEER_UP },
  { atTick: 24, command: STEER_LEVEL },
];

/** On level 3, standing next to an airplane that sits on the edge with its nose over the gap: the next interaction boards it. */
function readyToBoard(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 3 } });
  // In play he folds it from the paper the letter gives; here it is handed to him.
  giveItem(sim, AIRPLANE_ITEM_ID);
  sim.step([{ type: 'inventory/select', slot: 1 }]);
  // He reads the level's letter and puts it away, as he has by the time he flies: from here on a letter in the level is a new one.
  walkTo(sim, letterOf(sim)!.at.x);
  sim.step([INTERACT]);
  sim.step([INTERACT]);
  expect(letterOf(sim)).toBeUndefined();
  walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
  sim.step([{ type: 'item/use' }]);
  expect(airplaneOf(sim)).toMatchObject({ state: 'resting', onAnEdge: true });
  expect(interactionOf(sim)).toBe('board');
  return sim;
}

/** He has boarded, climbed as high as a flight that crosses the gap goes, and turned its nose down: it dives, nose still held down. */
function flyingHighWithItsNoseDown(): Sim {
  const sim = readyToBoard();
  sim.step([INTERACT]);
  sim.step([STEER_UP]);
  for (let tick = 0; tick < 30; tick += 1) sim.step();
  sim.step([STEER_DOWN]);
  for (let tick = 0; tick < 200 && airplaneOf(sim)!.pitch >= 0; tick += 1) sim.step();
  expect(airplaneOf(sim)).toMatchObject({ state: 'flying' });
  expect(airplaneOf(sim)!.at.y).toBeLessThan(-1);
  return sim;
}

/** Steps the sim for as long as the airplane flies, and gives what `read` made of it on every one of those ticks. */
function whileItFlies<Read>(sim: Sim, read: (airplane: NonNullable<ReturnType<typeof airplaneOf>>) => Read): Read[] {
  const readings: Read[] = [];
  for (let tick = 0; tick < 20 * TICK_RATE; tick += 1) {
    const airplane = airplaneOf(sim);
    if (airplane?.state !== 'flying') break;
    readings.push(read(airplane));
    sim.step();
  }
  return readings;
}

/** Plays `commands` from the tick after boarding until the airplane rests or is gone, and gives the airplane as it was after every tick. */
function flown(sim: Sim, commands: readonly { readonly atTick: number; readonly command: Command }[]): NonNullable<ReturnType<typeof airplaneOf>>[] {
  const airplanes: NonNullable<ReturnType<typeof airplaneOf>>[] = [];
  for (let tick = 0; tick < 20 * TICK_RATE; tick += 1) {
    sim.step(commands.filter(({ atTick }) => atTick === tick).map(({ command }) => command));
    const airplane = airplaneOf(sim);
    if (!airplane) break;
    airplanes.push(airplane);
    if (airplane.state === 'resting') break;
  }
  return airplanes;
}

/** `states` with every run of the same state as one. */
function collapsed<State>(states: readonly State[]): State[] {
  return states.filter((state, index) => state !== states[index - 1]);
}

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > stickManOf(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - stickManOf(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}
