import type { FloorSegment } from '../../content/levels/types';
import { STICK_MAN_HEIGHT } from '../../content/tuning';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { AIRPLANE_ITEM_ID } from '../inventory/defs';
import { holdsItem, replaceSelectedItem, selectedItemOf } from '../inventory/held';
import { startCarrying, stopCarrying, whereHeIs } from '../player/body';
import { floorHeightAt, lowestFloorHeight } from '../player/floor';
import type { SteerDirection } from './commands';
import { AIRPLANE } from './defs';
import { boardAndLaunch, moveOneTick } from './flight';
import { airplaneSlice, hasBoardedSlice, type AirplaneState } from './state';

/**
 * The paper airplane in the world. Using the airplane item puts it on the
 * floor in front of him; interacting next to it lifts it over his head, and
 * interacting again puts it down in front of him. It rests wherever its
 * middle has floor under it, so near the end of a line it sits on the edge
 * with its nose out. Put down too far past the edge, or still over his head
 * when he drops off one, it falls and is lost. Where it sits on an edge with
 * its nose over a gap, interacting boards it: he sits down in it and it
 * glides, steered by `'airplane/steer'` (`flight.ts`). Plain arithmetic on
 * the level's floor segments, no physics.
 */
export const airplaneFeature: Feature = {
  name: 'airplane',
  slices: [airplaneSlice, hasBoardedSlice],

  handleCommand(sim, command) {
    const { type, direction } = command as { type: string; direction?: unknown };
    if (type === 'airplane/steer' && isSteerDirection(direction)) sim.stateOf(airplaneSlice).steering = direction;
  },

  update(sim) {
    const airplane = sim.stateOf(airplaneSlice);
    if (!airplane.inWorld) return;
    const player = whereHeIs(sim);
    const floorLevel = lowestFloorHeight(sim.levelDef.floor);
    if (airplane.carried) {
      // In the air below the floor he is on his way down a gap or off the paper: he lets go of it.
      if (!player.onFloor && player.y > floorLevel) {
        letFall(airplane);
        stopCarrying(sim);
      } else {
        carryOverHisHead(sim);
      }
    }
    moveOneTick(sim);
  },
};

/** True while he has an airplane, as an item in a slot or in the world. False once it is lost, and before he has made one. */
export function hasAirplane(sim: Sim): boolean {
  return holdsItem(sim, AIRPLANE_ITEM_ID) || sim.stateOf(airplaneSlice).inWorld;
}

/**
 * True while the airplane rests on the floor with its nose out over a gap: where it is boarded from. An airplane whose
 * nose sticks out past the end of the paper, with no floor further on to fly to, does not count: it is only lifted.
 */
export function sitsOnAnEdge(sim: Sim): boolean {
  const airplane = sim.stateOf(airplaneSlice);
  if (!airplane.inWorld || airplane.carried || airplane.falling || airplane.flying || airplane.sliding) return false;
  const { floor } = sim.levelDef;
  const nose = airplane.x + (airplane.facing * AIRPLANE.length) / 2;
  const floorFurtherOn = floor.some(({ from, to }) => (airplane.facing === 1 ? from.x > nose : to.x < nose));
  return floorHeightAt(floor, nose) === undefined && floorFurtherOn;
}

/**
 * True while he has an airplane that he has still to take to an edge: it is in his slot, on the floor away from an
 * edge or over his head, the level has an edge to fly from, and he has not boarded one since the level started. It is
 * true again when the level starts again, a death included.
 */
export function hasYetToTakeItToAnEdge(sim: Sim): boolean {
  const airplane = sim.stateOf(airplaneSlice);
  const inFlight = airplane.inWorld && (airplane.flying || airplane.falling || airplane.sliding);
  if (sim.stateOf(hasBoardedSlice) || !hasAirplane(sim) || inFlight || sitsOnAnEdge(sim)) return false;
  const { floor } = sim.levelDef;
  return floor.some((line) => floor.some((other) => other.from.x > line.to.x));
}

/** True while the airplane sits on an edge, where it is boarded from, and he has not boarded one since the level started. */
export function isReadyToBoard(sim: Sim): boolean {
  return !sim.stateOf(hasBoardedSlice) && sitsOnAnEdge(sim);
}

/** What using the held item does when it is the airplane, for `features/item`: it is put on the floor in front of him. */
export function airplaneItemUse(sim: Sim) {
  const canPlace = selectedItemOf(sim) === AIRPLANE_ITEM_ID && whereHeIs(sim).onFloor && !sim.stateOf(airplaneSlice).inWorld;
  if (!canPlace) return undefined;
  return {
    means: 'place' as const,
    perform: () => {
      replaceSelectedItem(sim, null);
      putDownInFrontOfHim(sim);
    },
  };
}

/**
 * What interacting does with the airplane, for `features/world`: put it down while he carries it, board it where it
 * sits on an edge, or lift it anywhere else he stands next to it (ADR 0003).
 */
export function airplaneInteraction(sim: Sim) {
  const airplane = sim.stateOf(airplaneSlice);
  const player = whereHeIs(sim);
  if (!airplane.inWorld || airplane.falling || airplane.flying || airplane.sliding || !player.onFloor) return undefined;
  if (airplane.carried) return { means: 'putDown' as const, perform: () => putDownInFrontOfHim(sim) };
  if (Math.abs(player.x - airplane.x) > AIRPLANE.reach) return undefined;
  if (sitsOnAnEdge(sim)) return { means: 'board' as const, perform: () => boardAndLaunch(sim) };
  return {
    means: 'lift' as const,
    perform: () => {
      airplane.carried = true;
      startCarrying(sim);
      carryOverHisHead(sim);
    },
  };
}

// ---- Helpers ----

function isSteerDirection(value: unknown): value is SteerDirection {
  return value === -1 || value === 0 || value === 1;
}

/** The airplane leaves his hands or his slot for the floor in front of him, or for the air past the end of it. */
function putDownInFrontOfHim(sim: Sim): void {
  const airplane = sim.stateOf(airplaneSlice);
  const player = whereHeIs(sim);
  const { floor } = sim.levelDef;
  const middle = player.x + player.facing * AIRPLANE.putDownAhead;
  const resting = whereItRests(floor, { middle, facing: player.facing });
  stopCarrying(sim);
  airplane.inWorld = true;
  airplane.carried = false;
  airplane.facing = player.facing;
  airplane.verticalSpeed = 0;
  airplane.speed = 0;
  airplane.x = resting ?? middle;
  airplane.y = floorHeightAt(floor, airplane.x) ?? player.y;
  airplane.falling = resting === undefined;
}

function carryOverHisHead(sim: Sim): void {
  const airplane = sim.stateOf(airplaneSlice);
  const player = whereHeIs(sim);
  airplane.x = player.x;
  airplane.y = player.y - STICK_MAN_HEIGHT - AIRPLANE.carriedAbove;
  airplane.facing = player.facing;
}

function letFall(airplane: AirplaneState): void {
  airplane.carried = false;
  airplane.falling = true;
  airplane.verticalSpeed = 0;
  airplane.speed = 0;
}

/**
 * Where the middle of an airplane put down at `middle`, nose towards `facing`, comes to rest, or undefined when it
 * falls. It rests where it is put when there is floor under its middle. A little past the end of the line he put it
 * down from, it is pulled back to sit on that edge; it is never pulled on to the far side of a gap.
 */
function whereItRests(floor: readonly FloorSegment[], { middle, facing }: { middle: number; facing: 1 | -1 }): number | undefined {
  if (floorHeightAt(floor, middle) !== undefined) return middle;
  for (const { from, to } of floor) {
    const end = facing === 1 ? to.x : from.x;
    const past = (middle - end) * facing;
    if (past > 0 && past <= AIRPLANE.savedPastTheEdge) return end - facing * AIRPLANE.sitsBackFromTheEdge;
  }
  return undefined;
}

export const __testing__ = { whereItRests };
