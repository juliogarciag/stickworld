import type { FloorSegment } from '../../content/levels/types';
import { STICK_MAN_HEIGHT } from '../../content/tuning';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { AIRPLANE_ITEM_ID } from '../inventory/defs';
import { isHoldingItem, replaceSelectedItem, getSelectedItem } from '../inventory/held';
import { startCarrying, stopCarrying, getPlayerBody } from '../player/body';
import { getFloorHeightAt, getLowestFloorHeight } from '../player/floor';
import type { SteerDirection } from './commands';
import { AIRPLANE } from './defs';
import { boardAndLaunch, moveOneTick } from './flight';
import { airplaneSlice, hasBoardedSlice, type AirplaneState } from './state';

/**
 * The paper airplane in the world. Using the airplane item puts it on the
 * floor in front of the stick man; interacting next to it lifts it over the stick man's head, and
 * interacting again puts it down in front of the stick man. It rests wherever its
 * middle has floor under it, so near the end of a line it sits on the edge
 * with its nose out. Put down too far past the edge, or still over the stick man's head
 * when the stick man drops off one, it falls and is lost. Where it sits on an edge with
 * its nose over a gap, interacting boards it: the stick man sits down in it and it
 * glides, steered by `'airplane/steer'` (`flight.ts`). Plain arithmetic on
 * the level's floor segments, no physics.
 */
export const airplaneFeature: Feature = {
  name: 'airplane',
  slices: [airplaneSlice, hasBoardedSlice],

  handleCommand(sim, command) {
    const { type, direction } = command as { type: string; direction?: unknown };
    if (type === 'airplane/steer' && isSteerDirection(direction)) sim.getStateOf(airplaneSlice).steering = direction;
  },

  update(sim) {
    const airplane = sim.getStateOf(airplaneSlice);
    if (!airplane.isInWorld) return;
    const player = getPlayerBody(sim);
    const floorLevel = getLowestFloorHeight(sim.levelDef.floor);
    if (airplane.isCarried) {
      // In the air below the floor the stick man is on the stick man's way down a gap or off the paper: the stick man lets go of it.
      if (!player.isOnFloor && player.y > floorLevel) {
        letFall(airplane);
        stopCarrying(sim);
      } else {
        carryOverhead(sim);
      }
    }
    moveOneTick(sim);
  },
};

/** True while the stick man has an airplane, as an item in a slot or in the world. False once it is lost, and before the stick man has made one. */
export function hasAirplane(sim: Sim): boolean {
  return isHoldingItem(sim, AIRPLANE_ITEM_ID) || sim.getStateOf(airplaneSlice).isInWorld;
}

/**
 * True while the airplane rests on the floor with its nose out over a gap: where it is boarded from. An airplane whose
 * nose sticks out past the end of the paper, with no floor further on to fly to, does not count: it is only lifted.
 */
export function isSittingOnEdge(sim: Sim): boolean {
  const airplane = sim.getStateOf(airplaneSlice);
  if (!airplane.isInWorld || airplane.isCarried || airplane.isFalling || airplane.isFlying || airplane.isSliding) return false;
  const { floor } = sim.levelDef;
  const nose = airplane.x + (airplane.facing * AIRPLANE.length) / 2;
  const hasFloorAhead = floor.some((segment) => (airplane.facing === 1 ? segment.start.x > nose : segment.end.x < nose));
  return getFloorHeightAt(floor, nose) === undefined && hasFloorAhead;
}

/**
 * True while the stick man has an airplane that it has still to take to an edge: it is in the stick man's slot, on the floor away from an
 * edge or over the stick man's head, the level has an edge to fly from, and the stick man has not boarded one since the level started. It is
 * true again when the level starts again, a death included.
 */
export function hasYetToReachEdge(sim: Sim): boolean {
  const airplane = sim.getStateOf(airplaneSlice);
  const isInFlight = airplane.isInWorld && (airplane.isFlying || airplane.isFalling || airplane.isSliding);
  if (sim.getStateOf(hasBoardedSlice) || !hasAirplane(sim) || isInFlight || isSittingOnEdge(sim)) return false;
  const { floor } = sim.levelDef;
  return floor.some((line) => floor.some((other) => other.start.x > line.end.x));
}

/** True while the airplane sits on an edge, where it is boarded from, and the stick man has not boarded one since the level started. */
export function isReadyToBoard(sim: Sim): boolean {
  return !sim.getStateOf(hasBoardedSlice) && isSittingOnEdge(sim);
}

/** What using the held item does when it is the airplane, for `features/item`: it is put on the floor in front of the stick man. */
export function getAirplaneItemUse(sim: Sim) {
  const canPlace = getSelectedItem(sim) === AIRPLANE_ITEM_ID && getPlayerBody(sim).isOnFloor && !sim.getStateOf(airplaneSlice).isInWorld;
  if (!canPlace) return undefined;
  return {
    means: 'place' as const,
    perform: () => {
      replaceSelectedItem(sim, null);
      putDownInFront(sim);
    },
  };
}

/**
 * What interacting does with the airplane, for `features/world`: put it down while the stick man carries it, board it where it
 * sits on an edge, or lift it anywhere else the stick man stands next to it (ADR 0003).
 */
export function getAirplaneInteraction(sim: Sim) {
  const airplane = sim.getStateOf(airplaneSlice);
  const player = getPlayerBody(sim);
  if (!airplane.isInWorld || airplane.isFalling || airplane.isFlying || airplane.isSliding || !player.isOnFloor) return undefined;
  if (airplane.isCarried) return { means: 'putDown' as const, perform: () => putDownInFront(sim) };
  if (Math.abs(player.x - airplane.x) > AIRPLANE.reach) return undefined;
  if (isSittingOnEdge(sim)) return { means: 'board' as const, perform: () => boardAndLaunch(sim) };
  return {
    means: 'lift' as const,
    perform: () => {
      airplane.isCarried = true;
      startCarrying(sim);
      carryOverhead(sim);
    },
  };
}

// ---- Helpers ----

function isSteerDirection(value: unknown): value is SteerDirection {
  return value === -1 || value === 0 || value === 1;
}

/** The airplane leaves the stick man's hands or the stick man's slot for the floor in front of the stick man, or for the air past the end of it. */
function putDownInFront(sim: Sim): void {
  const airplane = sim.getStateOf(airplaneSlice);
  const player = getPlayerBody(sim);
  const { floor } = sim.levelDef;
  const middle = player.x + player.facing * AIRPLANE.putDownAhead;
  const resting = findRestingPlace(floor, { middle, facing: player.facing });
  stopCarrying(sim);
  airplane.isInWorld = true;
  airplane.isCarried = false;
  airplane.facing = player.facing;
  airplane.verticalSpeed = 0;
  airplane.speed = 0;
  airplane.x = resting ?? middle;
  airplane.y = getFloorHeightAt(floor, airplane.x) ?? player.y;
  airplane.isFalling = resting === undefined;
}

function carryOverhead(sim: Sim): void {
  const airplane = sim.getStateOf(airplaneSlice);
  const player = getPlayerBody(sim);
  airplane.x = player.x;
  airplane.y = player.y - STICK_MAN_HEIGHT - AIRPLANE.carriedAbove;
  airplane.facing = player.facing;
}

function letFall(airplane: AirplaneState): void {
  airplane.isCarried = false;
  airplane.isFalling = true;
  airplane.verticalSpeed = 0;
  airplane.speed = 0;
}

/**
 * Where the middle of an airplane put down at `middle`, nose towards `facing`, comes to rest, or undefined when it
 * falls. It rests where it is put when there is floor under its middle. A little past the end of the line the stick man put it
 * down from, it is pulled back to sit on that edge; it is never pulled on to the far side of a gap.
 */
function findRestingPlace(floor: readonly FloorSegment[], airplane: { middle: number; facing: 1 | -1 }): number | undefined {
  if (getFloorHeightAt(floor, airplane.middle) !== undefined) return airplane.middle;
  for (const segment of floor) {
    const edgeX = airplane.facing === 1 ? segment.end.x : segment.start.x;
    const overhang = (airplane.middle - edgeX) * airplane.facing;
    if (overhang > 0 && overhang <= AIRPLANE.edgeOverhangTolerance) return edgeX - airplane.facing * AIRPLANE.edgeInset;
  }
  return undefined;
}

export const __testing__ = { findRestingPlace };
