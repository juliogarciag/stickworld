import { describe, expect, it } from 'vitest';
import { level3 } from '../../content/levels/level3';
import { TICK_RATE } from '../../content/tuning';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { hashSnapshot } from '../../core/snapshot';
import { features } from '..';
import { findFlagPlacedIn } from '../flag';
import { flagDef } from '../flag/defs';
import { getFlag } from '../flag/view';
import { AIRPLANE_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { LETTER } from '../letter/defs';
import { getFallenItem, getLetter } from '../letter/view';
import { PLAYER } from '../player/defs';
import { getStickMan } from '../player/view';
import { getInteraction } from '../world/view';
import { AIRPLANE, FLIGHT } from './defs';
import { hasAirplane } from './index';
import { getAirplane, getSteeringAsked } from './view';

describe('boarding', () => {
  it('seats the stick man in the airplane and launches it forward off the edge, nose a little up', () => {
    const sim = createSimReadyToBoard();
    const resting = getAirplane(sim)!;
    sim.step([INTERACT]);
    const airplane = getAirplane(sim)!;
    expect(airplane).toMatchObject({ state: 'flying', facing: 1, isOnEdge: false });
    expect(airplane.pitch).toBeCloseTo(FLIGHT.launchPitch, 1);
    expect(airplane.speed).toBeCloseTo(FLIGHT.launchSpeed, 0);
    expect(airplane.position.x).toBeGreaterThan(resting.position.x);
    expect(airplane.position.y).toBeLessThan(resting.position.y);
    expect(getStickMan(sim)).toMatchObject({
      action: 'seated',
      feet: airplane.position,
      facing: 1,
      isCarrying: false,
    });
    expect(getInteraction(sim)).toBeNull();
  });

  it('keeps the stick man from walking or turning: the walk keys do nothing while the stick man is seated', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    sim.step([{ type: 'player/walk', direction: -1 }]);
    let previousX = getAirplane(sim)!.position.x;
    for (let tick = 0; tick < 30; tick += 1) {
      sim.step();
      const airplane = getAirplane(sim)!;
      expect(getStickMan(sim)).toMatchObject({
        action: 'seated',
        feet: airplane.position,
        facing: 1,
      });
      expect(airplane.position.x).toBeGreaterThan(previousX);
      previousX = airplane.position.x;
    }
  });

  it('is not undone by a jump that arrives on the same tick, before or after the interaction: the stick man stays seated', () => {
    for (const commands of [
      [INTERACT, JUMP],
      [JUMP, INTERACT],
    ]) {
      const sim = createSimReadyToBoard();
      sim.step(commands);
      expect(getStickMan(sim).action).toBe('seated');
      expect(getAirplane(sim)!.state).toBe('flying');
      for (let tick = 0; tick < 10; tick += 1) {
        sim.step();
      }
      expect(getStickMan(sim).action).toBe('seated');
      // The next jump is the stick man's own: it takes the stick man out.
      sim.step([JUMP]);
      expect(getStickMan(sim).action).toBe('jumping');
    }
  });

  it('cannot be interacted with while it flies: the press does nothing', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    const compared = createSimReadyToBoard();
    compared.step([INTERACT]);
    sim.step([INTERACT]);
    compared.step();
    expect(sim.takeSnapshot().slices).toEqual(compared.takeSnapshot().slices);
  });
});

describe('the glide', () => {
  it('pays for every metre climbed with speed, by the tuning values', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    const before = getAirplane(sim)!;
    const ticks = 20;
    sim.step([STEER_UP]);
    for (let tick = 1; tick < ticks; tick += 1) {
      sim.step();
    }
    const after = getAirplane(sim)!;
    const climbed = before.position.y - after.position.y;
    expect(climbed).toBeGreaterThan(0.5);
    expect(before.speed - after.speed).toBeCloseTo(
      climbed * FLIGHT.speedLostPerMetreClimbed + (ticks / TICK_RATE) * FLIGHT.speedLostPerSecond,
      6,
    );
  });

  it('gives speed back for every metre dived, less than the climb cost', () => {
    const sim = createSimFlyingHighNoseDown();
    const before = getAirplane(sim)!;
    const ticks = 15;
    for (let tick = 0; tick < ticks; tick += 1) {
      sim.step();
    }
    const after = getAirplane(sim)!;
    const dived = after.position.y - before.position.y;
    expect(dived).toBeGreaterThan(0.2);
    expect(after.speed).toBeGreaterThan(before.speed);
    expect(after.speed - before.speed).toBeCloseTo(
      dived * FLIGHT.speedGainedPerMetreDived - (ticks / TICK_RATE) * FLIGHT.speedLostPerSecond,
      6,
    );
    expect(FLIGHT.speedGainedPerMetreDived).toBeLessThan(FLIGHT.speedLostPerMetreClimbed);
  });

  it('goes where its nose points: forward and up by its speed', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    const before = getAirplane(sim)!;
    sim.step([STEER_UP]);
    const after = getAirplane(sim)!;
    expect(after.pitch).toBeCloseTo(before.pitch + FLIGHT.pitchRate / TICK_RATE, 9);
    expect(after.position.x - before.position.x).toBeCloseTo(
      (before.speed * Math.cos(after.pitch)) / TICK_RATE,
      9,
    );
    expect(before.position.y - after.position.y).toBeCloseTo(
      (before.speed * Math.sin(after.pitch)) / TICK_RATE,
      9,
    );
  });

  it('turns its nose no further than the steepest climb and the steepest dive', () => {
    const climbing = createSimReadyToBoard();
    climbing.step([INTERACT]);
    climbing.step([STEER_UP]);
    const pitches = recordDuringFlight(climbing, (airplane) => airplane.pitch);
    expect(Math.max(...pitches)).toBe(FLIGHT.steepestClimb);

    const diving = createSimReadyToBoard();
    diving.step([INTERACT]);
    diving.step([STEER_DOWN]);
    expect(Math.min(...recordDuringFlight(diving, (airplane) => airplane.pitch))).toBe(
      FLIGHT.steepestDive,
    );
  });

  it('left alone, sinks its nose to where it rests and glides down from there', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    const pitches = recordDuringFlight(sim, (airplane) => airplane.pitch);
    expect(pitches).toEqual([...pitches].sort((one, other) => other - one));
    expect(pitches[pitches.length - 1]).toBe(FLIGHT.restingPitch);
    expect(FLIGHT.restingPitch).toBeLessThan(0);
  });

  it('never goes faster than its fastest speed, however far it dives', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    sim.step([STEER_DOWN]);
    expect(Math.max(...recordDuringFlight(sim, (airplane) => airplane.speed))).toBeLessThanOrEqual(
      FLIGHT.fastestSpeed,
    );
  });

  it('stalls below the stall speed: it stops flying and falls, with the stick man still in it', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    sim.step([STEER_UP]);
    const speeds = recordDuringFlight(sim, (airplane) => airplane.speed);
    expect(speeds[speeds.length - 1]).toBeGreaterThanOrEqual(FLIGHT.stallSpeed);
    expect(speeds[speeds.length - 1]).toBeLessThan(FLIGHT.stallSpeed + 0.2);
    expect(getAirplane(sim)!.state).toBe('falling');
    expect(getAirplane(sim)!.position.x).toBeLessThan(FAR_SIDE);

    // Steering does nothing for it now: it drops faster and faster, and the stick man goes with it.
    sim.step([STEER_DOWN]);
    let previous = getAirplane(sim)!;
    for (let tick = 0; tick < 20; tick += 1) {
      sim.step([tick % 2 === 0 ? STEER_UP : STEER_DOWN]);
      const airplane = getAirplane(sim)!;
      expect(airplane.state).toBe('falling');
      expect(airplane.verticalSpeed - previous.verticalSpeed).toBeCloseTo(
        AIRPLANE.gravity / TICK_RATE,
        9,
      );
      expect(getStickMan(sim)).toMatchObject({ action: 'seated', feet: airplane.position });
      previous = airplane;
    }
  });
});

describe("'airplane/steer'", () => {
  it('is remembered until the next one, and ignores what is malformed', () => {
    const sim = createSimReadyToBoard();
    sim.step([STEER_UP]);
    expect(getSteeringAsked(sim)).toBe(1);
    const malformed = [
      { type: 'airplane/steer' },
      { type: 'airplane/steer', direction: 2 },
      { type: 'airplane/steer', direction: 'up' },
      { type: 'airplane/steer', direction: null },
      { type: 'airplane/steer', direction: 0.5 },
    ];
    for (const command of malformed) {
      sim.step([command as unknown as Command]);
      expect(getSteeringAsked(sim)).toBe(1);
    }
    sim.step([STEER_DOWN]);
    expect(getSteeringAsked(sim)).toBe(-1);
    sim.step([{ type: 'airplane/steer', direction: 0 }]);
    expect(getSteeringAsked(sim)).toBe(0);
  });

  it('does nothing to an airplane that is not flying', () => {
    const sim = createSimReadyToBoard();
    const resting = getAirplane(sim);
    sim.step([STEER_UP]);
    for (let tick = 0; tick < 30; tick += 1) {
      sim.step();
    }
    expect(getAirplane(sim)).toEqual(resting);
    expect(getStickMan(sim).action).toBe('standing');
  });
});

describe('landing', () => {
  it('comes down on the line, slides to a stop losing its speed, and the stick man stands up where it lies', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    const states = recordFlight(sim, FLIGHT_THAT_CROSSES).map((airplane) => airplane.state);
    expect(collapseRepeats(states)).toEqual(['flying', 'landing', 'resting']);

    const airplane = getAirplane(sim)!;
    expect(airplane).toMatchObject({
      state: 'resting',
      speed: 0,
      pitch: 0,
      verticalSpeed: 0,
      position: { y: 0 },
    });
    expect(airplane.position.x).toBeGreaterThan(FAR_SIDE);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: airplane.position });
    // It is an airplane on the floor like any other: the stick man can lift it again.
    expect(getInteraction(sim)).toBe('lift');
  });

  it('loses its speed by the tuning value while it slides, with the stick man still seated', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    const sliding = recordFlight(sim, FLIGHT_THAT_CROSSES).filter(
      (airplane) => airplane.state === 'landing',
    );
    expect(sliding.length).toBeGreaterThan(5);
    for (let index = 1; index < sliding.length; index += 1) {
      expect(sliding[index - 1]!.speed - sliding[index]!.speed).toBeCloseTo(
        FLIGHT.landingSlowdown / TICK_RATE,
        9,
      );
      expect(sliding[index]!.position.y).toBe(0);
    }
  });

  it('does not reach the flag while the stick man is seated: flying or sliding past it does not finish the level, standing next to it does', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    const flag = findFlagPlacedIn(level3)!;
    let hasPassedFlagSeated = false;
    for (const command of [
      STEER_UP,
      ...Array.from({ length: 41 }, () => undefined),
      STEER_LEVEL,
      ...Array.from({ length: 400 }, () => undefined),
    ]) {
      sim.step(command ? [command] : []);
      const { action, feet } = getStickMan(sim);
      if (action !== 'seated') {
        break;
      }
      expect(getFlag(sim)!.isReached).toBe(false);
      if (Math.abs(feet.x - flag.position.x) <= flagDef.reach && feet.y > -flagDef.height) {
        hasPassedFlagSeated = true;
      }
    }
    expect(hasPassedFlagSeated).toBe(true);
    expect(getStickMan(sim).action).toBe('standing');
    walkTo(sim, flag.position.x);
    expect(getFlag(sim)!.isReached).toBe(true);
  });
});

describe('a floor line', () => {
  it('is not flown through from below: under it the airplane stops gliding and falls, with the stick man in it', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    // Left alone it sinks under the far line; then the nose is held up.
    for (let tick = 0; tick < 600 && getAirplane(sim)!.position.x < FAR_SIDE; tick += 1) {
      sim.step();
    }
    expect(getAirplane(sim)!.position.y).toBeGreaterThan(0);
    sim.step([STEER_UP]);
    let highest = Infinity;
    for (let tick = 0; tick < 10 * TICK_RATE && getStickMan(sim).action === 'seated'; tick += 1) {
      highest = Math.min(highest, getAirplane(sim)!.position.y);
      sim.step();
    }
    expect(highest).toBeGreaterThan(0);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: level3.start });
    expect(getAirplane(sim)).toBeUndefined();
  });

  it('is not jumped through from below either: under it a jump is dropped, the stick man stays seated and falls with the airplane', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    // A climb too short to cross: it passes under the far edge.
    sim.step([STEER_UP]);
    for (let tick = 1; tick < 600 && getAirplane(sim)!.position.x < FAR_SIDE + 0.5; tick += 1) {
      sim.step(tick === 14 ? [STEER_LEVEL] : []);
    }
    expect(getAirplane(sim)!.position.y).toBeGreaterThan(0);
    for (let tick = 0; tick < 10 * TICK_RATE && getStickMan(sim).action === 'seated'; tick += 1) {
      sim.step([{ type: 'player/walk', direction: 1 }, JUMP]);
      expect(getStickMan(sim).action).not.toBe('jumping');
    }
    expect(getStickMan(sim)).toMatchObject({ feet: level3.start });
    expect(getFlag(sim)!.isReached).toBe(false);
    expect(getAirplane(sim)).toBeUndefined();
  });

  it('is slid off when it comes down too late: past the end of the paper it falls with the stick man still in it, and the level starts again', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    const lateLanding = [
      { atTick: 0, command: STEER_UP },
      { atTick: 20, command: STEER_LEVEL },
      { atTick: 95, command: STEER_UP },
      { atTick: 125, command: STEER_LEVEL },
    ];
    const states = collapseRepeats(
      recordFlight(sim, lateLanding).map((airplane) => airplane.state),
    );
    expect(states.slice(-2)).toEqual(['landing', 'falling']);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: level3.start });
    expect(getAirplane(sim)).toBeUndefined();
  });
});

describe('jumping out', () => {
  it("stands the stick man up and jumps the stick man out of the stick man's seat; the airplane falls on without the stick man", () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    for (let tick = 0; tick < 25; tick += 1) {
      sim.step();
    }
    const seatedAt = getStickMan(sim).feet;
    const flying = getAirplane(sim)!;
    sim.step([{ type: 'player/jump' }]);
    expect(getStickMan(sim)).toMatchObject({ action: 'jumping', isFallingOffEdge: false });
    expect(getStickMan(sim).verticalSpeed).toBeCloseTo(
      -Math.sqrt(2 * PLAYER.riseGravity * PLAYER.jumpHeight) + PLAYER.riseGravity / TICK_RATE,
      9,
    );
    expect(getStickMan(sim).feet.y).toBeLessThan(seatedAt.y);
    const unmanned = getAirplane(sim)!;
    expect(unmanned.state).toBe('falling');
    // It keeps the sideways and the downward part of the way it was going.
    expect(unmanned.speed).toBeCloseTo(flying.speed * Math.cos(flying.pitch), 9);
    expect(unmanned.position.x).toBeGreaterThan(flying.position.x);

    // No walk key held: the stick man comes straight down into the gap, the level starts again and
    // the airplane that flew on is gone.
    for (let tick = 0; tick < 5 * TICK_RATE && getStickMan(sim).action === 'jumping'; tick += 1) {
      sim.step();
    }
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: level3.start });
    expect(getAirplane(sim)).toBeUndefined();
  });

  it('early, walking back to the near side, saves the stick man and loses the airplane: the stick man is not left with one it cannot reach, and a new sheet of paper falls', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    sim.step([{ type: 'player/walk', direction: -1 }, { type: 'player/jump' }]);
    for (let tick = 0; tick < 12 * TICK_RATE && !getFallenItem(sim); tick += 1) {
      sim.step();
    }
    expect(getStickMan(sim).feet.x).toBeLessThanOrEqual(EDGE);
    expect(hasAirplane(sim)).toBe(false);
    expect(getFallenItem(sim)!.height).toBeGreaterThan(0);
  });

  it('leaves an airplane that comes down over the floor lying there, to be lifted again', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    sim.step([STEER_UP]);
    for (let tick = 1; tick < 500 && getAirplane(sim)!.position.x < FAR_SIDE + 1; tick += 1) {
      sim.step(tick === 30 ? [STEER_LEVEL] : []);
    }
    expect(getAirplane(sim)!.state).toBe('flying');
    sim.step([{ type: 'player/jump' }]);
    for (let tick = 0; tick < 3 * TICK_RATE; tick += 1) {
      sim.step();
    }
    expect(getAirplane(sim)).toMatchObject({ state: 'resting', position: { y: 0 }, speed: 0 });
    expect(getAirplane(sim)!.position.x).toBeGreaterThan(FAR_SIDE);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: { y: 0 } });
    expect(getStickMan(sim).feet.x).toBeGreaterThan(FAR_SIDE);
    expect(hasAirplane(sim)).toBe(true);
  });
});

describe('falling while flying', () => {
  it('starts the level again once the airplane is out of sight below the floor, and that airplane is lost with it', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    let deepest = 0;
    let ticks = 0;
    for (; ticks < 10 * TICK_RATE && getStickMan(sim).action === 'seated'; ticks += 1) {
      deepest = Math.max(deepest, getAirplane(sim)!.position.y);
      expect(getLetter(sim)).toBeUndefined();
      sim.step();
    }
    expect(deepest).toBeGreaterThan(FLIGHT.lostBelowFloor - 0.2);
    expect(deepest).toBeLessThanOrEqual(FLIGHT.lostBelowFloor);
    expect(getStickMan(sim)).toMatchObject({ action: 'standing', feet: level3.start });
    expect(sim.level).toBe(3);
    expect(getAirplane(sim)).toBeUndefined();
    // The stick man has read the letter, so it starts again with a new airplane in its hand and no
    // letter has to fall.
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: AIRPLANE_ITEM_ID, isSelected: true }]);
    for (let tick = 0; tick < Math.round(LETTER.fallsAfter * TICK_RATE) + 2; tick += 1) {
      sim.step();
    }
    expect(getFallenItem(sim)).toBeUndefined();
  });
});

describe('a flight', () => {
  it('is all in the snapshot: restored in the middle of it, it goes on exactly as it would have', () => {
    const sim = createSimReadyToBoard();
    sim.step([INTERACT]);
    sim.step([STEER_UP]);
    for (let tick = 0; tick < 20; tick += 1) {
      sim.step();
    }
    const restored = new Sim({ features, snapshot: sim.takeSnapshot() });
    for (let tick = 0; tick < 200; tick += 1) {
      const commands = tick === 10 ? [STEER_LEVEL] : [];
      sim.step(commands);
      restored.step(commands);
    }
    expect(hashSnapshot(restored.takeSnapshot())).toBe(hashSnapshot(sim.takeSnapshot()));
    expect(getStickMan(sim).feet.x).toBeGreaterThan(FAR_SIDE);
  });
});

// ---- Helpers ----

const EDGE = level3.floor[0]!.end.x;
const FAR_SIDE = level3.floor[1]!.start.x;

const INTERACT: Command = { type: 'world/interact' };
const JUMP: Command = { type: 'player/jump' };
const STEER_UP: Command = { type: 'airplane/steer', direction: 1 };
const STEER_LEVEL: Command = { type: 'airplane/steer', direction: 0 };
const STEER_DOWN: Command = { type: 'airplane/steer', direction: -1 };

/**
 * Climb for 24 ticks from the first tick of the flight, then let it glide: one of the flights that
 * crosses level 3's gap (`level3.test.ts` has the whole range).
 */
const FLIGHT_THAT_CROSSES: readonly { readonly atTick: number; readonly command: Command }[] = [
  { atTick: 0, command: STEER_UP },
  { atTick: 24, command: STEER_LEVEL },
];

/**
 * On level 3, standing next to an airplane that sits on the edge with its nose over the gap: the
 * next interaction boards it.
 */
function createSimReadyToBoard(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 3 } });
  // In play the stick man folds it from the paper the letter gives; here it is handed to the stick
  // man.
  giveItem(sim, AIRPLANE_ITEM_ID);
  sim.step([{ type: 'inventory/select', slot: 1 }]);
  // The stick man reads the level's letter and puts it away, as the stick man has by the time the
  // stick man flies: from here on a letter in the level is a new one.
  walkTo(sim, getLetter(sim)!.position.x);
  sim.step([INTERACT]);
  sim.step([INTERACT]);
  expect(getLetter(sim)).toBeUndefined();
  walkTo(sim, EDGE - AIRPLANE.putDownAhead - AIRPLANE.length / 4);
  sim.step([{ type: 'item/use' }]);
  expect(getAirplane(sim)).toMatchObject({ state: 'resting', isOnEdge: true });
  expect(getInteraction(sim)).toBe('board');
  return sim;
}

/**
 * The stick man has boarded, climbed as high as a flight that crosses the gap goes, and turned its
 * nose down: it dives, nose still held down.
 */
function createSimFlyingHighNoseDown(): Sim {
  const sim = createSimReadyToBoard();
  sim.step([INTERACT]);
  sim.step([STEER_UP]);
  for (let tick = 0; tick < 30; tick += 1) {
    sim.step();
  }
  sim.step([STEER_DOWN]);
  for (let tick = 0; tick < 200 && getAirplane(sim)!.pitch >= 0; tick += 1) {
    sim.step();
  }
  expect(getAirplane(sim)).toMatchObject({ state: 'flying' });
  expect(getAirplane(sim)!.position.y).toBeLessThan(-1);
  return sim;
}

/**
 * Steps the sim for as long as the airplane flies, and gives what `read` made of it on every one of
 * those ticks.
 */
function recordDuringFlight<Read>(
  sim: Sim,
  read: (airplane: NonNullable<ReturnType<typeof getAirplane>>) => Read,
): Read[] {
  const readings: Read[] = [];
  for (let tick = 0; tick < 20 * TICK_RATE; tick += 1) {
    const airplane = getAirplane(sim);
    if (airplane?.state !== 'flying') {
      break;
    }
    readings.push(read(airplane));
    sim.step();
  }
  return readings;
}

/**
 * Plays `commands` from the tick after boarding until the airplane rests or is gone, and gives the
 * airplane as it was after every tick.
 */
function recordFlight(
  sim: Sim,
  commands: readonly { readonly atTick: number; readonly command: Command }[],
): NonNullable<ReturnType<typeof getAirplane>>[] {
  const airplanes: NonNullable<ReturnType<typeof getAirplane>>[] = [];
  for (let tick = 0; tick < 20 * TICK_RATE; tick += 1) {
    sim.step(commands.filter((entry) => entry.atTick === tick).map((entry) => entry.command));
    const airplane = getAirplane(sim);
    if (!airplane) {
      break;
    }
    airplanes.push(airplane);
    if (airplane.state === 'resting') {
      break;
    }
  }
  return airplanes;
}

/** `states` with every run of the same state as one. */
function collapseRepeats<State>(states: readonly State[]): State[] {
  return states.filter((state, index) => state !== states[index - 1]);
}

/** Walks the stick man to `x` and stops it there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > getStickMan(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - getStickMan(sim).feet.x) * direction > 0; tick += 1) {
    sim.step();
  }
  sim.step([{ type: 'player/walk', direction: 0 }]);
}
